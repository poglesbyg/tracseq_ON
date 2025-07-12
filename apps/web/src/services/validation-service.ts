import { ValidationError } from '../errors/domain-errors'
import type { GuideRNA, DesignParameters } from '../lib/crispr/guide-design'

import type {
  CrisprDesignRequest,
  CrisprAnalysisRequest,
  BatchProcessingRequest,
} from './crispr-service'

export class ValidationService {
  /**
   * Validate CRISPR design request
   */
  validateDesignRequest(request: CrisprDesignRequest): Promise<void> {
    if (!request.sequence) {
      throw new ValidationError('Sequence is required', 'MISSING_SEQUENCE', {
        request,
      })
    }

    if (!request.parameters) {
      throw new ValidationError(
        'Design parameters are required',
        'MISSING_PARAMETERS',
        { request },
      )
    }

    this.validateSequence(request.sequence)
    this.validateDesignParameters(request.parameters)
    return Promise.resolve()
  }

  /**
   * Validate CRISPR analysis request
   */
  validateAnalysisRequest(request: CrisprAnalysisRequest): Promise<void> {
    if (!request.sequence) {
      throw new ValidationError(
        'Sequence is required for analysis',
        'MISSING_SEQUENCE',
        { request },
      )
    }

    if (!request.guides || request.guides.length === 0) {
      throw new ValidationError(
        'At least one guide RNA is required for analysis',
        'MISSING_GUIDES',
        { request },
      )
    }

    if (!request.analysisType) {
      throw new ValidationError(
        'Analysis type is required',
        'MISSING_ANALYSIS_TYPE',
        { request },
      )
    }

    const validAnalysisTypes = ['off-target', '3d-structure', 'efficiency']
    if (!validAnalysisTypes.includes(request.analysisType)) {
      throw new ValidationError(
        'Invalid analysis type',
        'INVALID_ANALYSIS_TYPE',
        { request, validTypes: validAnalysisTypes },
      )
    }

    this.validateSequence(request.sequence)

    for (const guide of request.guides) {
      this.validateGuideRNA(guide)
    }
    return Promise.resolve()
  }

  /**
   * Validate batch processing request
   */
  validateBatchRequest(request: BatchProcessingRequest): Promise<void> {
    if (!request.sequences || request.sequences.length === 0) {
      throw new ValidationError(
        'At least one sequence is required for batch processing',
        'MISSING_SEQUENCES',
        { request },
      )
    }

    if (request.sequences.length > 100) {
      throw new ValidationError(
        'Batch size too large. Maximum 100 sequences allowed',
        'BATCH_SIZE_TOO_LARGE',
        { request, maxSize: 100 },
      )
    }

    if (!request.parameters) {
      throw new ValidationError(
        'Design parameters are required for batch processing',
        'MISSING_PARAMETERS',
        { request },
      )
    }

    this.validateDesignParameters(request.parameters)

    // Validate each sequence
    for (let i = 0; i < request.sequences.length; i++) {
      try {
        this.validateSequence(request.sequences[i])
      } catch (error) {
        throw new ValidationError(
          `Invalid sequence at position ${i + 1}`,
          'INVALID_BATCH_SEQUENCE',
          { request, sequenceIndex: i, originalError: error },
        )
      }
    }
    return Promise.resolve()
  }

  /**
   * Validate guide RNA object
   */
  validateGuideRNA(guide: GuideRNA): void {
    if (!guide.sequence) {
      throw new ValidationError(
        'Guide RNA sequence is required',
        'MISSING_GUIDE_SEQUENCE',
        { guide },
      )
    }

    if (guide.sequence.length !== 20) {
      throw new ValidationError(
        'Guide RNA sequence must be exactly 20 nucleotides',
        'INVALID_GUIDE_LENGTH',
        { guide, expectedLength: 20 },
      )
    }

    // Validate sequence contains only valid DNA bases
    const validDNA = /^[acgt]+$/i
    if (!validDNA.test(guide.sequence)) {
      throw new ValidationError(
        'Guide RNA sequence contains invalid characters. Only A, T, C, G allowed',
        'INVALID_GUIDE_SEQUENCE',
        { guide },
      )
    }

    if (!guide.pamSequence) {
      throw new ValidationError(
        'PAM sequence is required',
        'MISSING_PAM_SEQUENCE',
        { guide },
      )
    }

    if (
      typeof guide.efficiencyScore !== 'number' ||
      guide.efficiencyScore < 0 ||
      guide.efficiencyScore > 1
    ) {
      throw new ValidationError(
        'Efficiency score must be a number between 0 and 1',
        'INVALID_EFFICIENCY_SCORE',
        { guide },
      )
    }

    if (
      typeof guide.specificityScore !== 'number' ||
      guide.specificityScore < 0 ||
      guide.specificityScore > 1
    ) {
      throw new ValidationError(
        'Specificity score must be a number between 0 and 1',
        'INVALID_SPECIFICITY_SCORE',
        { guide },
      )
    }
  }

  /**
   * Validate DNA sequence
   */
  private validateSequence(sequence: string): void {
    if (!sequence || typeof sequence !== 'string') {
      throw new ValidationError(
        'Sequence must be a non-empty string',
        'INVALID_SEQUENCE_TYPE',
        { sequence },
      )
    }

    if (sequence.length < 20) {
      throw new ValidationError(
        'Sequence too short. Minimum length: 20 nucleotides',
        'SEQUENCE_TOO_SHORT',
        { sequence, minLength: 20 },
      )
    }

    if (sequence.length > 50000) {
      throw new ValidationError(
        'Sequence too long. Maximum length: 50,000 nucleotides',
        'SEQUENCE_TOO_LONG',
        { sequence, maxLength: 50000 },
      )
    }

    // Validate DNA sequence (allow N for ambiguous bases)
    const validDNA = /^[acgnt]+$/i
    if (!validDNA.test(sequence)) {
      throw new ValidationError(
        'Invalid DNA sequence. Only A, T, C, G, N characters allowed',
        'INVALID_DNA_SEQUENCE',
        { sequence },
      )
    }

    // Check for excessive N content
    const nCount = (sequence.match(/n/gi) || []).length
    const nPercentage = (nCount / sequence.length) * 100
    if (nPercentage > 10) {
      throw new ValidationError(
        'Sequence contains too many ambiguous bases (N). Maximum 10% allowed',
        'EXCESSIVE_AMBIGUOUS_BASES',
        { sequence, nPercentage },
      )
    }
  }

  /**
   * Validate design parameters
   */
  private validateDesignParameters(parameters: DesignParameters): void {
    if (!parameters.targetSequence) {
      throw new ValidationError(
        'Target sequence is required in design parameters',
        'MISSING_TARGET_SEQUENCE',
        { parameters },
      )
    }

    this.validateSequence(parameters.targetSequence)

    if (!parameters.pamType) {
      throw new ValidationError('PAM type is required', 'MISSING_PAM_TYPE', {
        parameters,
      })
    }

    const validPamTypes = ['NGG', 'NRG', 'NNGRRT']
    if (!validPamTypes.includes(parameters.pamType)) {
      throw new ValidationError('Invalid PAM type', 'INVALID_PAM_TYPE', {
        parameters,
        validTypes: validPamTypes,
      })
    }

    if (
      typeof parameters.minEfficiencyScore !== 'number' ||
      parameters.minEfficiencyScore < 0 ||
      parameters.minEfficiencyScore > 1
    ) {
      throw new ValidationError(
        'Minimum efficiency score must be a number between 0 and 1',
        'INVALID_MIN_EFFICIENCY_SCORE',
        { parameters },
      )
    }

    if (
      typeof parameters.maxOffTargets !== 'number' ||
      parameters.maxOffTargets < 0 ||
      parameters.maxOffTargets > 10000
    ) {
      throw new ValidationError(
        'Maximum off-targets must be a number between 0 and 10,000',
        'INVALID_MAX_OFF_TARGETS',
        { parameters },
      )
    }

    if (typeof parameters.allowNonCanonicalPAMs !== 'boolean') {
      throw new ValidationError(
        'Allow non-canonical PAMs must be a boolean',
        'INVALID_ALLOW_NON_CANONICAL_PAMS',
        { parameters },
      )
    }
  }

  /**
   * Validate user ID format
   */
  validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError(
        'User ID must be a non-empty string',
        'INVALID_USER_ID',
        { userId },
      )
    }

    if (userId.length < 3 || userId.length > 50) {
      throw new ValidationError(
        'User ID must be between 3 and 50 characters',
        'INVALID_USER_ID_LENGTH',
        { userId },
      )
    }

    // Allow alphanumeric, hyphens, and underscores
    const validUserIdPattern = /^[\w-]+$/
    if (!validUserIdPattern.test(userId)) {
      throw new ValidationError(
        'User ID contains invalid characters. Only letters, numbers, hyphens, and underscores allowed',
        'INVALID_USER_ID_FORMAT',
        { userId },
      )
    }
  }

  /**
   * Validate project ID format
   */
  validateProjectId(projectId: string): void {
    if (!projectId || typeof projectId !== 'string') {
      throw new ValidationError(
        'Project ID must be a non-empty string',
        'INVALID_PROJECT_ID',
        { projectId },
      )
    }

    if (projectId.length < 3 || projectId.length > 50) {
      throw new ValidationError(
        'Project ID must be between 3 and 50 characters',
        'INVALID_PROJECT_ID_LENGTH',
        { projectId },
      )
    }

    // Allow alphanumeric, hyphens, and underscores
    const validProjectIdPattern = /^[\w-]+$/
    if (!validProjectIdPattern.test(projectId)) {
      throw new ValidationError(
        'Project ID contains invalid characters. Only letters, numbers, hyphens, and underscores allowed',
        'INVALID_PROJECT_ID_FORMAT',
        { projectId },
      )
    }
  }
}
