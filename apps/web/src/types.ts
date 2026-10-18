export type DecisionStatus = "ACTIVE" | "SUPERSEDED"
export type DecisionState = "PENDING" | "DECIDED"

export type User = {
  id: string
  externalId: string
  displayName: string
  avatarUrl?: string | null
}

export type SourceMessage = {
  author: string
  timestamp: string
  text: string
  anchor?: boolean
}

export type SourceSnapshot = {
  id: string
  provider: string
  anchorText?: string | null
  channelName?: string | null
  permalink?: string | null
  capturedAt: string
  messages: SourceMessage[]
  sourceContext?: {
    entryPoint?: string
    invokingUserId?: string
    teamId?: string
    totalMessageCount?: number | null
    captureStatus?: "CAPTURED" | "INCOMPLETE"
    channelName?: string
    capturedMessageCount?: number
    captureTruncated?: boolean
    textTruncated?: boolean
    aiDraft?: {
      outcome: "DECISION" | "NO_CLEAR_DECISION"
      confidence: "high" | "medium" | "low"
      relevantMessageIds: string[]
    }
  }
}

export type ExternalReference = {
  id: string
  kind: string
  label: string
  url: string
}

export type RelatedDecision = {
  id: string
  decisionKey: string
  title: string
  status: DecisionStatus
  decisionState?: DecisionState
  outcome?: string | null
  replacementReason?: string | null
  replacedAt?: string
}

export type Decision = {
  id: string
  decisionKey: string
  title: string
  decisionState: DecisionState
  outcome: string | null
  dueDate: string | null
  decidedAt: string | null
  why?: string | null
  context?: string | null
  appliesTo: string[]
  optionsConsidered: string[]
  owner?: User | null
  ownerId?: string | null
  ownerName?: string | null
  tags: string[]
  status: DecisionStatus
  createdAt: string
  updatedAt: string
  evidenceCount: number
  sources?: SourceSnapshot[]
  references?: ExternalReference[]
  supersededBy?: Array<Pick<RelatedDecision, "id" | "decisionKey"> & Partial<RelatedDecision>>
  lifecycle?: {
    current?: RelatedDecision[]
    supersedes: RelatedDecision[]
    supersededBy: RelatedDecision[]
  }
}

export type Metadata = {
  workspace: {
    id: string
    name: string
  }
  currentUser: {
    id: string
    displayName: string
  }
  users: User[]
  ownerNames: string[]
  tags: string[]
  channels: string[]
  appliesTo: string[]
  features: {
    memorySearch: boolean
    geminiMemorySearch: boolean
    jira: boolean
    slack: boolean
    proposalAnalysis: boolean
  }
}

export type MemorySearchMatch = {
  decisionId: string
  score: number
  explanation: string
  matchedConcepts: string[]
  decision: Decision
}

export type MemorySearchMethod = "LOCAL" | "GEMINI"

export type ProposalAssessment = "POSSIBLE_MISMATCH" | "APPEARS_CONSISTENT" | "INSUFFICIENT_EVIDENCE"
export type ProposalEvidence = {
  decisionId: string
  decisionKey: string
  title: string
  status: DecisionStatus
  appliesTo: string[]
  role: "MATCH" | "CURRENT_SUCCESSOR"
  inScope: boolean
  currentIds: string[]
  replacements: { decisionId: string; decisionKey: string; reason: string | null }[]
  excerpts: { id: string; decisionId: string; field: string; label: string; text: string }[]
  excerpted: boolean
}
export type ProposalReview = {
  proposal: string
  appliesTo: string | null
  method: MemorySearchMethod
  coverage: { indexed: number; total: number; retrieved: number; omittedSuccessors: number; excerpted: boolean }
  evidence: ProposalEvidence[]
  analysis: {
    status: "NOT_REQUESTED" | "COMPLETE" | "UNAVAILABLE"
    assessment: ProposalAssessment | null
    message: string
    findings: { assessment: ProposalAssessment; explanation: string; citations: { evidenceId: string; quote: string }[] }[]
  }
}

export type MemorySearchResponse = {
  method?: MemorySearchMethod
  // Set by the library when it ran local search after empty keyword results.
  automatic?: boolean
  candidateCount: number
  totalCandidateCount?: number
  truncated?: boolean
  matches: MemorySearchMatch[]
}

export type DecisionInput = {
  title: string
  decisionState: DecisionState
  outcome: string | null
  dueDate: string | null
  why: string
  context: string
  appliesTo: string[]
  optionsConsidered: string[]
  ownerId: string
  ownerName: string
  tags: string[]
  references: Array<{
    kind: "JIRA" | "URL"
    label: string
    url: string
  }>
}

export type JiraProject = {
  key: string
  name: string
}

export type JiraIssueType = {
  id: string
  name: string
}


export type ScopeSummary = {
  scope: string
  decisionCount: number
  activeCount: number
  openCount: number
  latestDecisionAt: string | null
}

export type ScopeOverview = {
  scope: string
  decisionCount: number
  openCount: number
  activeDecisions: Decision[]
  openQuestions: Decision[]
  changes: Array<{
    previous: RelatedDecision
    replacement: RelatedDecision
    replacementReason: string | null
    replacedAt: string
  }>
}
