'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { useAccount } from "wagmi"
import { ConnectKitButton } from "connectkit"
import { toast } from 'react-toastify'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, AlertCircle, InfoIcon } from "lucide-react"
import stakingAbi from '../lib/abi/Staking.json'
import governanceAbi from '../lib/abi/Governance.json'
import stakingTokenAbi from '../lib/abi/StakingToken.json'

const STAKING_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STAKING_CONTRACT_ADDRESS || ""
const GOVERNANCE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS || ""
const STAKING_TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_STAKING_TOKEN_CONTRACT_ADDRESS || ""

type Proposal = {
  id: number
  proposer: string
  voteStart: number
  voteEnd: number
  executed: boolean
  canceled: boolean
  forVotes: string
  againstVotes: string
  abstainVotes: string
  description: string
  state: string
}

export function Pixel8LabsTestApp() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null)
  const [signer, setSigner] = useState<ethers.Signer | null>(null)
  const [stakingContract, setStakingContract] = useState<ethers.Contract | null>(null)
  const [stakingTokenContract, setStakingTokenContract] = useState<ethers.Contract | null>(null)
  const [governanceContract, setGovernanceContract] = useState<ethers.Contract | null>(null)
  const [account, setAccount] = useState<string>("")
  const [stakedAmount, setStakedAmount] = useState<string>("0")
  const [rewards, setRewards] = useState<string>("0")
  const [governancePower, setGovernancePower] = useState<string>("0")
  const [stakeAmount, setStakeAmount] = useState<string>("")
  const [unstakeAmount, setUnstakeAmount] = useState<string>("")
  const [mintAmount, setMintAmount] = useState<string>("")
  const [proposalDescription, setProposalDescription] = useState<string>("")
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [delegateAddress, setDelegateAddress] = useState<string>("")
  const [topStakers, setTopStakers] = useState<string[]>([])
  const [tokenBalance, setTokenBalance] = useState<string>("0")

  const { address, isConnecting, isDisconnected } = useAccount()

  useEffect(() => {
    if (address) {
      setAccount(address)
      initializeContracts()
    }
  }, [address])

  const initializeContracts = async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const stakingContract = new ethers.Contract(STAKING_CONTRACT_ADDRESS, stakingAbi.abi, signer)
      const governanceContract = new ethers.Contract(GOVERNANCE_CONTRACT_ADDRESS, governanceAbi.abi, signer)
      const stakingTokenContract = new ethers.Contract(STAKING_TOKEN_CONTRACT_ADDRESS, stakingTokenAbi.abi, signer)

      setProvider(provider)
      setSigner(signer)
      setStakingContract(stakingContract)
      setGovernanceContract(governanceContract)
      setStakingTokenContract(stakingTokenContract)
      await updateData(stakingContract, governanceContract, stakingTokenContract, address)
    } catch (err:any) {
      setError(err.message || "Failed to initialize contracts. Please try again.")
      toast.error(err.message || "Failed to initialize contracts. Please try again.")
    }
    setLoading(false)
  }

  const updateData = async (stakingContract: ethers.Contract, governanceContract: ethers.Contract, stakingTokenContract: ethers.Contract, account: string) => {
    try {
      const [staked, rewards, governancePower, topStakers, tokenBalance] = await Promise.all([
        stakingContract.getStakedAmount(account),
        stakingContract.getRewards(account),
        governanceContract.getVotingPower(account),
        stakingContract.getTopStakers(),
        stakingTokenContract.balanceOf(account)
      ])

      setStakedAmount(ethers.formatEther(staked))
      setRewards(ethers.formatEther(rewards))
      setGovernancePower(ethers.formatEther(governancePower))
      setTopStakers(topStakers)
      setTokenBalance(ethers.formatEther(tokenBalance))

  

      // Fetch Proposals
      await fetchProposals(governanceContract)

    } catch (error: any) {
      console.error("Error updating data:", error)
      setError(`Failed to update data: ${error.message}`)
      toast.error(`Failed to update account data: ${error.message}`)
    }
  }

  const getProposalState = (stateNum: number): string => {
    const states = ['Pending', 'Active', 'Canceled', 'Defeated', 'Succeeded', 'Queued', 'Executed']
    return states[stateNum] || 'Unknown'
  }

  const fetchProposals = async (governanceContract: ethers.Contract) => {
    try {
      const filter = governanceContract.filters.ProposalCreated()
      const events = await governanceContract.queryFilter(filter)
      const proposals: Proposal[] = await Promise.all(events.map(async (event) => {
        // @ts-ignore
        const [id, proposer, , , , voteStart, voteEnd, description] = event.args
        const proposal = await governanceContract.proposals(id)
        const state = await governanceContract.state(id)
        return {
          id: id,
          proposer,
          voteStart: voteStart,
          voteEnd: voteEnd,
          executed: proposal.executed,
          canceled: proposal.canceled,
          forVotes: ethers.formatEther(proposal.forVotes),
          againstVotes: ethers.formatEther(proposal.againstVotes),
          abstainVotes: ethers.formatEther(proposal.abstainVotes),
          description,
          state: getProposalState(state)
        }
      }))
      setProposals(proposals)
    } catch (error: any) {
      console.error("Error fetching proposals:", error)
      toast.error(`Failed to fetch proposals: ${error.message}`)
    }
  }

  const handleStake = async () => {
    if (!stakeAmount || !stakingContract || !stakingTokenContract) return
    setLoading(true)
    setError(null)
    try {
      // Convert stakeAmount to Wei
      const amount = ethers.parseEther(stakeAmount)

      // Approve the staking contract to spend tokens
      const approveTx = await stakingTokenContract.approve(stakingContract.target, amount)
      await approveTx.wait()

      // Stake the tokens
      const stakeTx = await stakingContract.stake(amount)
      await stakeTx.wait()

      // Update data
      await updateData(stakingContract, governanceContract!, stakingTokenContract, account)
      setStakeAmount("")
      toast.success(`Successfully staked ${stakeAmount} tokens.`)
    } catch (err: any) {
      console.error("Staking error:", err)
      setError(`Failed to stake: ${err.message}`)
      toast.error(`Failed to stake tokens: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUnstake = async () => {
    if (!unstakeAmount || !stakingContract) return
    setLoading(true)
    setError(null)
    try {
      const tx = await stakingContract.unstake(ethers.parseEther(unstakeAmount))
      await tx.wait()
      await updateData(stakingContract, governanceContract!, stakingTokenContract!, account)
      setUnstakeAmount("")
      toast.success(`Successfully unstaked ${unstakeAmount} tokens.`)
    } catch (err:any) {
      setError(`Failed to unstake: ${err.message}`)
      toast.error(`Failed to unstake tokens: ${err.message}`)
    }
    setLoading(false)
  }

  const handleClaim = async () => {
    if (!stakingContract) return
    setLoading(true)
    setError(null)
    try {
      const tx = await stakingContract.claimRewards()
      await tx.wait()
      await updateData(stakingContract, governanceContract!, stakingTokenContract!, account)
      toast.success("Successfully claimed rewards.")
    } catch (err:any) {
      setError(`Failed to claim rewards: ${err.message}`)
      toast.error(`Failed to claim rewards: ${err.message}`)
    }
    setLoading(false)
  }

  const handleCompound = async () => {
    if (!stakingContract) return
    setLoading(true)
    setError(null)
    try {
      const tx = await stakingContract.compound()
      await tx.wait()
      await updateData(stakingContract, governanceContract!, stakingTokenContract!, account)
      toast.success("Successfully compounded rewards.")
    } catch (err:any) {
      setError(`Failed to compound rewards: ${err.message}`)
      toast.error(`Failed to compound rewards: ${err.message}`)
    }
    setLoading(false)
  }

  const handleEmergencyWithdraw = async () => {
    if (!stakingContract) return
    setLoading(true)
    setError(null)
    try {
      const tx = await stakingContract.emergencyWithdraw()
      await tx.wait()
      await updateData(stakingContract, governanceContract!, stakingTokenContract!, account)
      toast.success("Successfully performed emergency withdrawal.")
    } catch (err:any) {
      setError(`Failed to perform emergency withdrawal: ${err.message}`)
      toast.error(`Failed to perform emergency withdrawal: ${err.message}`)
    }
    setLoading(false)
  }

  const handleMint = async () => {
    if (!mintAmount || !stakingTokenContract) {
      toast.error("Please enter an amount and ensure you're connected.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const tx = await stakingTokenContract.mint(ethers.parseEther(mintAmount))
      toast.info("Transaction submitted. Waiting for confirmation...")
      await tx.wait()
      toast.success(`Successfully minted ${mintAmount} tokens.`)
      setMintAmount("")
      if (stakingContract && governanceContract) {
        await updateData(stakingContract, governanceContract, stakingTokenContract, account)
      }
    } catch (err: any) {
      console.error("Minting error:", err)
      setError(`Failed to mint: ${err.message}`)
      toast.error(`Failed to mint tokens: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProposal = async () => {
    if (!proposalDescription || !governanceContract) return
    setLoading(true)
    setError(null)
    try {
      const tx = await governanceContract.propose([], [], [], proposalDescription)
      await tx.wait()
      await fetchProposals(governanceContract)
      setProposalDescription("")
      toast.success("Successfully created a new proposal.")
    } catch (err:any) {
      setError(`Failed to create proposal: ${err.message}`)
      toast.error(`Failed to create proposal: ${err.message}`)
    }
    setLoading(false)
  }

  const handleVote = async (proposalId: number, support: number) => {
    if (!governanceContract) return
    setLoading(true)
    setError(null)
    try {
      const tx = await governanceContract.castVote(proposalId, support)
      await tx.wait()
      await fetchProposals(governanceContract)
      toast.success(`Successfully voted on proposal #${proposalId}.`)
    } catch (err:any) {
      setError(`Failed to vote: ${err.message}`)
      toast.error(`Failed to vote: ${err.message}`)
    }
    setLoading(false)
  }

  const handleExecuteProposal = async (proposalId: number) => {
    if (!governanceContract) return
    setLoading(true)
    setError(null)
    try {
      const tx = await governanceContract.executeProposal(proposalId)
      await tx.wait()
      await fetchProposals(governanceContract)
      toast.success(`Successfully executed proposal #${proposalId}.`)
    } catch (err:any) {
      setError(`Failed to execute proposal: ${err.message}`)
      toast.error(`Failed to execute proposal: ${err.message}`)
    }
    setLoading(false)
  }

  const handleCancelProposal = async (proposalId: number) => {
    if (!governanceContract) return
    setLoading(true)
    setError(null)
    try {
      const tx = await governanceContract.cancelProposal(proposalId)
      await tx.wait()
      await fetchProposals(governanceContract)
      toast.success(`Successfully canceled proposal #${proposalId}.`)
    } catch (err:any) {
      setError(`Failed to cancel proposal: ${err.message}`)
      toast.error(`Failed to cancel proposal: ${err.message}`)
    }
    setLoading(false)
  }

  const handleDelegate = async () => {
    if (!delegateAddress || !governanceContract) return
    setLoading(true)
    setError(null)
    try {
      const tx = await governanceContract.delegate(delegateAddress)
      await tx.wait()
      await updateData(stakingContract!, governanceContract, stakingTokenContract!, account)
      setDelegateAddress("")
      toast.success(`Successfully delegated to ${delegateAddress}.`)
    } catch (err:any) {
      setError(`Failed to delegate: ${err.message}`)
      toast.error(`Failed to delegate: ${err.message}`)
    }
    setLoading(false)
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pixel8Labs Test: Ethereum Staking & Governance</h1>
        <ConnectKitButton />
      </div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account Overview</CardTitle>
          <CardDescription>Your staking stats and governance power</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium">Connected Account:</p>
              {account ? (
                <p className="text-xs truncate">{account}</p>
              ) : (
                <Skeleton className="h-4 w-full" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Staked Amount:</p>
              {stakedAmount ? (
                <p>{stakedAmount} tokens</p>
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Available Rewards:</p>
              {rewards ? (
                <p>{rewards} tokens</p>
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Token Balance:</p>
              {tokenBalance ? (
                <p>{tokenBalance} tokens</p>
              ) : (
                <Skeleton className="h-4 w-20" />
              )}
            </div>
          </div>
          <div className="mt-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    <p className="text-lg font-semibold mr-2">Governance Power:</p>
                    <InfoIcon className="h-4 w-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Governance power determines your voting weight in proposals</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {governancePower ? (
              <p className="text-3xl font-bold">{governancePower}</p>
            ) : (
              <Skeleton className="h-8 w-24" />
            )}
          </div>
        </CardContent>
      </Card>
      <Tabs defaultValue="staking" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="staking">Staking</TabsTrigger>
          <TabsTrigger value="mint">Mint</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>
        <TabsContent value="staking">
          <Card>
            <CardHeader>
              <CardTitle>Staking Dashboard</CardTitle>
              <CardDescription>Stake, unstake, and manage your rewards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="Amount to stake"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  aria-label="Amount to stake"
                />
                <Button onClick={handleStake} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Stake
                </Button>
              </div>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="Amount to unstake"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  aria-label="Amount to unstake"
                />
                <Button onClick={handleUnstake} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Unstake
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button onClick={handleClaim} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Claim Rewards
              </Button>
              <Button onClick={handleCompound} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Compound Rewards
              </Button>
              <Button onClick={handleEmergencyWithdraw} disabled={loading} variant="destructive">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Emergency Withdraw
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="mint">
          <Card>
            <CardHeader>
              <CardTitle>Mint Tokens</CardTitle>
              <CardDescription>Mint new staking tokens</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="Amount to mint"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                  aria-label="Amount to mint"
                />
                <Button onClick={handleMint} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Mint
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="governance">
          <Card>
            <CardHeader>
              <CardTitle>Governance</CardTitle>
              <CardDescription>Create and vote on proposals, and manage delegation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  placeholder="Proposal description"
                  value={proposalDescription}
                  onChange={(e) => setProposalDescription(e.target.value)}
                  aria-label="Proposal description"
                />
              </div>
              <Button onClick={handleCreateProposal} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Proposal
              </Button>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Proposals</h3>
                {proposals.length > 0 ? (
                  proposals.map((proposal) => (
                    <Card key={proposal.id}>
                      <CardHeader>
                        <CardTitle>Proposal #{proposal.id}</CardTitle>
                        <CardDescription>{proposal.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p>Proposer: {proposal.proposer}</p>
                        <p>State: {proposal.state}</p>
                        <p>For: {proposal.forVotes} votes</p>
                        <p>Against: {proposal.againstVotes} votes</p>
                        <p>Abstain: {proposal.abstainVotes} votes</p>
                        {/* <p>Starts: {new Date(proposal.voteStart * 1000).toLocaleString()}</p>
                        <p>Ends: {new Date(proposal.voteEnd * 1000).toLocaleString()}</p> */}
                      </CardContent>
                      <CardFooter>
                        {proposal.state === 'Active' && (
                          <>
                            <Button onClick={() => handleVote(proposal.id, 1)} className="mr-2" disabled={loading}>
                              Vote For
                            </Button>
                            <Button onClick={() => handleVote(proposal.id, 0)} className="mr-2" disabled={loading}>
                              Vote Against
                            </Button>
                            <Button onClick={() => handleVote(proposal.id, 2)} variant="outline" disabled={loading}>
                              Abstain
                            </Button>
                          </>
                        )}
                        {proposal.state === 'Succeeded' && (
                          <Button onClick={() => handleExecuteProposal(proposal.id)} disabled={loading}>
                            Execute Proposal
                          </Button>
                        )}
                        {proposal.state === 'Pending' && (
                          <Button onClick={() => handleCancelProposal(proposal.id)} variant="destructive" disabled={loading}>
                            Cancel Proposal
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <p>No proposals at the moment.</p>
                )}
              </div>
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Delegate Governance Power</h3>
                <div className="flex space-x-2">
                  <Input
                    placeholder="Delegate address"
                    value={delegateAddress}
                    onChange={(e) => setDelegateAddress(e.target.value)}
                    aria-label="Delegate address"
                  />
                  <Button onClick={handleDelegate} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Delegate
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle>Leaderboard</CardTitle>
              <CardDescription>Top stakers in the protocol</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Rank</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topStakers.map((staker, index) => (
                    <TableRow key={staker}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{staker}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}