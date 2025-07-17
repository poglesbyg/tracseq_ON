import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ragService } from '../../src/lib/ai/rag-system'
import type { RAGResult } from '../../src/lib/ai/rag-system'

// Mock external dependencies
vi.mock('../../src/lib/ai/ollama-service', () => ({
  aiService: {
    isAvailable: vi.fn(),
    generateResponse: vi.fn(),
    extractFormData: vi.fn()
  }
}))

vi.mock('pdf-parse', () => ({
  default: vi.fn()
}))

describe('AI Service Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('RAG System', () => {
    it('should initialize successfully', async () => {
      const isAvailable = await ragService.isAvailable()
      expect(isAvailable).toBe(true)
    })

    it('should process extracted text with field mappings', async () => {
      const extractedPairs = [
        { key: 'sample name', value: 'TEST-001' },
        { key: 'submitter', value: 'John Doe' },
        { key: 'email', value: 'john@example.com' },
        { key: 'concentration', value: '50.5 ng/μL' }
      ]

      const result = await ragService.processExtractedText(extractedPairs)

      expect(result.matches).toHaveLength(4)
      expect(result.overallConfidence).toBeGreaterThan(0)
      expect(result.processingTime).toBeGreaterThan(0)
      
      // Check that sample name was matched
      const sampleNameMatch = result.matches.find(m => m.fieldName === 'sampleName')
      expect(sampleNameMatch).toBeDefined()
      expect(sampleNameMatch?.extractedValue).toBe('TEST-001')
      expect(sampleNameMatch?.confidence).toBeGreaterThan(0.8)
    })

    it('should validate field values correctly', async () => {
      const extractedPairs = [
        { key: 'sample name', value: '' }, // Required field empty
        { key: 'email', value: 'invalid-email' }, // Invalid email format
        { key: 'concentration', value: '-50' } // Invalid concentration
      ]

      const result = await ragService.processExtractedText(extractedPairs)

      expect(result.validationIssues.length).toBeGreaterThan(0)
      
      // Check for validation failures
      const failedMatches = result.matches.filter(m => !m.validationPassed)
      expect(failedMatches.length).toBeGreaterThan(0)
    })

    it('should enhance extraction results with recommendations', async () => {
      const extractedData = {
        sampleName: 'TEST-001',
        submitterName: 'John Doe'
        // Missing required email field
      }

      const result = await ragService.enhanceExtraction(extractedData)

      expect(result.enhancedData).toBeDefined()
      expect(result.ragInsights).toBeDefined()
      expect(result.recommendations).toBeInstanceOf(Array)
      expect(result.recommendations.length).toBeGreaterThan(0)
      
      // Should recommend missing required fields
      const missingFieldsRecommendation = result.recommendations.find(r => 
        r.includes('Missing required fields')
      )
      expect(missingFieldsRecommendation).toBeDefined()
    })

    it('should calculate confidence scores based on field quality', async () => {
      const highQualityData = {
        sampleName: 'TEST-001',
        submitterName: 'John Doe',
        submitterEmail: 'john@example.com',
        concentration: '50.5 ng/μL',
        volume: '25 μL'
      }

      const lowQualityData = {
        sampleName: 'TEST-002',
        submitterEmail: 'invalid-email'
      }

      const highQualityResult = await ragService.enhanceExtraction(highQualityData)
      const lowQualityResult = await ragService.enhanceExtraction(lowQualityData)

      expect(highQualityResult.ragInsights.overallConfidence)
        .toBeGreaterThan(lowQualityResult.ragInsights.overallConfidence)
    })

    it('should handle empty input gracefully', async () => {
      const emptyData = {}

      const result = await ragService.enhanceExtraction(emptyData)

      expect(result.enhancedData).toBeDefined()
      expect(result.ragInsights).toBeDefined()
      expect(result.recommendations).toBeInstanceOf(Array)
      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it('should provide specific field recommendations', async () => {
      const problematicData = {
        sampleName: 'invalid sample name!',
        submitterName: '',
        submitterEmail: 'not-an-email',
        concentration: 'invalid-concentration'
      }

      const result = await ragService.enhanceExtraction(problematicData)

      expect(result.recommendations.length).toBeGreaterThan(0)
      
      // Should have specific recommendations for each issue
      const recommendations = result.recommendations.join(' ')
      expect(recommendations).toContain('Missing required fields')
    })

    it('should handle field alias matching', async () => {
      const extractedPairs = [
        { key: 'sample id', value: 'TEST-001' }, // Alias for sampleName
        { key: 'contact name', value: 'John Doe' }, // Alias for submitterName
        { key: 'e-mail', value: 'john@example.com' }, // Alias for submitterEmail
        { key: 'conc', value: '50.5' } // Alias for concentration
      ]

      const result = await ragService.processExtractedText(extractedPairs)

      expect(result.matches).toHaveLength(4)
      
      // Check that aliases were properly mapped
      const fieldNames = result.matches.map(m => m.fieldName)
      expect(fieldNames).toContain('sampleName')
      expect(fieldNames).toContain('submitterName')
      expect(fieldNames).toContain('submitterEmail')
      expect(fieldNames).toContain('concentration')
    })

    it('should maintain performance with large datasets', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        key: `field_${i}`,
        value: `value_${i}`
      }))

      const startTime = Date.now()
      const result = await ragService.processExtractedText(largeDataset)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(result.processingTime).toBeLessThan(5000)
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete workflow simulation', async () => {
      // Simulate a complete extraction workflow
      const mockExtractedData = {
        sampleName: 'INTEGRATION-TEST-001',
        submitterName: 'Integration Test User',
        submitterEmail: 'integration@test.com',
        labName: 'Test Lab',
        sampleType: 'DNA',
        concentration: '75.0 ng/μL',
        volume: '20 μL',
        priority: 'High'
      }

      // Step 1: Enhance with RAG
      const ragResult = await ragService.enhanceExtraction(mockExtractedData)
      
      expect(ragResult.enhancedData).toBeDefined()
      expect(ragResult.ragInsights.overallConfidence).toBeGreaterThan(0.8)
      expect(ragResult.recommendations.length).toBeLessThan(3) // Should have minimal issues

      // Step 2: Verify enhanced data quality
      expect(ragResult.enhancedData.sampleName).toBe('INTEGRATION-TEST-001')
      expect(ragResult.enhancedData.submitterName).toBe('Integration Test User')
      expect(ragResult.enhancedData.submitterEmail).toBe('integration@test.com')
    })

    it('should handle error recovery scenarios', async () => {
      // Test with problematic data that should trigger fallbacks
      const problematicData = {
        'weird_field_name': 'some value',
        'another_unknown_field': 'another value'
      }

      const result = await ragService.enhanceExtraction(problematicData)

      // Should not crash and should provide meaningful feedback
      expect(result).toBeDefined()
      expect(result.enhancedData).toBeDefined()
      expect(result.recommendations).toBeInstanceOf(Array)
      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it('should maintain consistency across multiple calls', async () => {
      const testData = {
        sampleName: 'CONSISTENCY-TEST',
        submitterName: 'Test User',
        submitterEmail: 'test@example.com'
      }

      // Run the same extraction multiple times
      const results = await Promise.all([
        ragService.enhanceExtraction(testData),
        ragService.enhanceExtraction(testData),
        ragService.enhanceExtraction(testData)
      ])

      // Results should be consistent
      expect(results[0].ragInsights.overallConfidence)
        .toBeCloseTo(results[1].ragInsights.overallConfidence, 2)
      expect(results[1].ragInsights.overallConfidence)
        .toBeCloseTo(results[2].ragInsights.overallConfidence, 2)
    })
  })
}) 