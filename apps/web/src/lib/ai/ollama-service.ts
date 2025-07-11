import { Ollama } from 'ollama'

// Initialize Ollama client
const ollama = new Ollama({ host: 'http://localhost:11434' })

export interface AIAnalysisResult {
  analysis: string
  suggestions: string[]
  confidence: number
  reasoning: string
}

export interface GuideOptimizationResult {
  optimizedSequence?: string
  improvements: string[]
  riskAssessment: string
  confidence: number
}

export interface ExperimentSuggestion {
  title: string
  description: string
  rationale: string
  priority: 'high' | 'medium' | 'low'
}

class OllamaService {
  private model = 'llama3.1:latest' // Default model, can be configured
  private isAvailable = false
  private workingModel: string | null = null

  async initialize() {
    try {
      // Check if Ollama is running and model is available
      const models = await ollama.list()
      this.isAvailable = models.models.some(m => m.name === this.model || m.name.includes(this.model.split(':')[0]))
      
      if (!this.isAvailable) {
        // Try different model names that might work
        const modelVariants = [
          'llama3.1:latest',
          'llama3.1:8b', 
          'llama3.1',
          'llama3:latest',
          'llama3:8b',
          'llama3'
        ]
        
        console.log('🔍 Testing model variants...')
        
        for (const modelName of modelVariants) {
          try {
            console.log(`Testing ${modelName}...`)
            const testResponse = await ollama.generate({
              model: modelName,
              prompt: "Test",
              stream: false,
              options: { temperature: 0.1 }
            })
            
            if (testResponse.response) {
              this.workingModel = modelName
              this.model = modelName
              this.isAvailable = true
              console.log(`✅ Ollama AI service initialized with model: ${modelName} (found working model)`)
              return true
            }
          } catch (testError) {
            console.log(`❌ ${modelName} failed`)
          }
        }
        
        console.warn(`Ollama models not accessible. AI features will use advanced fallback responses.`)
        console.log('Available models via API:', models.models.map(m => m.name))
        console.log('💡 Tip: Try running "ollama run llama3.1" in terminal to ensure model is loaded')
      } else {
        this.workingModel = this.model
        console.log(`✅ Ollama AI service initialized with model: ${this.model}`)
      }
      
      return this.isAvailable
    } catch (error) {
      console.warn('Ollama not available:', error)
      this.isAvailable = false
      return false
    }
  }

  async analyzeSequence(sequence: string, context?: string): Promise<AIAnalysisResult> {
    if (!this.isAvailable) {
      return this.getFallbackSequenceAnalysis(sequence)
    }

    try {
      const prompt = `
As a CRISPR expert, analyze this DNA sequence for guide RNA design:

Sequence: ${sequence}
Length: ${sequence.length} bp
${context ? `Context: ${context}` : ''}

Please provide:
1. Overall assessment of the sequence for CRISPR targeting
2. Potential challenges or concerns
3. Specific suggestions for guide RNA design
4. Risk factors to consider

Respond in JSON format with: analysis, suggestions (array), confidence (0-1), reasoning
`

      const response = await ollama.generate({
        model: this.workingModel || this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        }
      })

      return this.parseAIResponse(response.response, 'sequence_analysis')
    } catch (error) {
      console.error('AI sequence analysis failed:', error)
      return this.getFallbackSequenceAnalysis(sequence)
    }
  }

  async optimizeGuideRNA(
    guideSequence: string, 
    targetSequence: string, 
    pamSequence: string
  ): Promise<GuideOptimizationResult> {
    if (!this.isAvailable) {
      return this.getFallbackGuideOptimization(guideSequence)
    }

    try {
      const prompt = `
As a CRISPR guide RNA optimization expert, analyze and suggest improvements for this guide:

Guide RNA: ${guideSequence}
PAM: ${pamSequence}
Target context: ${targetSequence.slice(Math.max(0, targetSequence.indexOf(guideSequence) - 50), targetSequence.indexOf(guideSequence) + guideSequence.length + 50)}

Analyze:
1. GC content and distribution
2. Secondary structure potential
3. Off-target risk factors
4. Efficiency predictors
5. Possible sequence modifications

Provide specific suggestions for improvement and risk assessment.
Respond in JSON format with: optimizedSequence, improvements (array), riskAssessment, confidence (0-1)
`

      const response = await ollama.generate({
        model: this.workingModel || this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.6,
          top_p: 0.8,
        }
      })

      return this.parseGuideOptimization(response.response)
    } catch (error) {
      console.error('AI guide optimization failed:', error)
      return this.getFallbackGuideOptimization(guideSequence)
    }
  }

  async generateExperimentSuggestions(
    experimentType: string,
    targetGene?: string,
    organism?: string
  ): Promise<ExperimentSuggestion[]> {
    if (!this.isAvailable) {
      return this.getFallbackExperimentSuggestions(experimentType)
    }

    try {
      const prompt = `
As a CRISPR experimental design expert, suggest innovative experiments for:

Type: ${experimentType}
${targetGene ? `Target Gene: ${targetGene}` : ''}
${organism ? `Organism: ${organism}` : ''}

Provide 3-5 creative and scientifically sound experiment ideas that would:
1. Advance the field
2. Be technically feasible
3. Address important biological questions
4. Consider current best practices

For each suggestion, include title, description, rationale, and priority level.
Respond in JSON format as an array of objects with: title, description, rationale, priority
`

      const response = await ollama.generate({
        model: this.workingModel || this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.8,
          top_p: 0.9,
        }
      })

      return this.parseExperimentSuggestions(response.response)
    } catch (error) {
      console.error('AI experiment suggestions failed:', error)
      return this.getFallbackExperimentSuggestions(experimentType)
    }
  }

  async answerQuestion(question: string, context?: any): Promise<string> {
    if (!this.isAvailable) {
      return this.getFallbackAnswer(question)
    }

    try {
      const contextStr = context ? JSON.stringify(context, null, 2) : ''
      const prompt = `
As a CRISPR expert assistant, answer this question:

Question: ${question}

${contextStr ? `Context: ${contextStr}` : ''}

Provide a clear, accurate, and helpful answer based on current CRISPR knowledge and best practices.
Be specific and actionable when possible.
`

      const response = await ollama.generate({
        model: this.workingModel || this.model,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        }
      })

      return response.response
    } catch (error) {
      console.error('AI question answering failed:', error)
      return this.getFallbackAnswer(question)
    }
  }

  private parseAIResponse(response: string, _type: string): AIAnalysisResult {
    try {
      const parsed = JSON.parse(response)
      return {
        analysis: parsed.analysis || 'Analysis completed',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
        reasoning: parsed.reasoning || 'AI analysis performed'
      }
    } catch {
      return {
        analysis: response.slice(0, 500),
        suggestions: ['Review sequence manually', 'Consider alternative approaches'],
        confidence: 0.6,
        reasoning: 'Response parsing failed, using raw output'
      }
    }
  }

  private parseGuideOptimization(response: string): GuideOptimizationResult {
    try {
      const parsed = JSON.parse(response)
      return {
        optimizedSequence: parsed.optimizedSequence,
        improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
        riskAssessment: parsed.riskAssessment || 'Standard risk profile',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7
      }
    } catch {
      return {
        improvements: ['Consider manual optimization', 'Review GC content'],
        riskAssessment: 'Unable to assess - manual review recommended',
        confidence: 0.5
      }
    }
  }

  private parseExperimentSuggestions(response: string): ExperimentSuggestion[] {
    try {
      const parsed = JSON.parse(response)
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          title: item.title || 'Experimental Approach',
          description: item.description || 'Description not available',
          rationale: item.rationale || 'Rationale not provided',
          priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium'
        }))
      }
    } catch {
      // Fallback handled below
    }
    
    return this.getFallbackExperimentSuggestions('general')
  }

  // Fallback methods for when AI is not available
  private getFallbackSequenceAnalysis(sequence: string): AIAnalysisResult {
    const gcContent = (sequence.match(/[CG]/g) || []).length / sequence.length * 100
    const length = sequence.length
    
    // More sophisticated fallback analysis
    const hasRepeats = /(.{3,})\1{2,}/.test(sequence)
    const hasLowComplexity = /([ATCG])\1{4,}/.test(sequence)
    const pamSites = (sequence.match(/[ATCG]GG/g) || []).length + (sequence.match(/CC[ATCG]/g) || []).length
    
    let analysis = `Sequence analysis: ${length} bp with ${gcContent.toFixed(1)}% GC content. `
    
    if (gcContent < 20) {
      analysis += 'Low GC content may reduce guide RNA stability and efficiency. '
    } else if (gcContent > 80) {
      analysis += 'High GC content may cause secondary structures and reduce accessibility. '
    } else if (gcContent >= 40 && gcContent <= 60) {
      analysis += 'Optimal GC content for efficient guide RNA design. '
    } else {
      analysis += 'GC content is within acceptable range. '
    }
    
    analysis += `Found ${pamSites} potential PAM sites (NGG/CCN). `
    
    if (hasRepeats) {
      analysis += 'Contains repetitive sequences that may complicate guide design. '
    }
    
    if (hasLowComplexity) {
      analysis += 'Contains low-complexity regions that should be avoided for guide placement. '
    }
    
    const suggestions = [
      'Verify sequence quality and remove any ambiguous bases',
      'Consider multiple guide options across the target region',
      'Validate PAM site availability in target context'
    ]
    
    if (gcContent < 40) {
      suggestions.push('Consider guides with higher GC content within the target region')
    }
    
    if (gcContent > 60) {
      suggestions.push('Avoid guides with excessive GC content to prevent secondary structures')
    }
    
    if (hasRepeats) {
      suggestions.push('Avoid repetitive regions when selecting guide RNA sequences')
    }
    
    if (pamSites < 3) {
      suggestions.push('Limited PAM sites available - consider alternative target regions')
    }
    
    return {
      analysis,
      suggestions,
      confidence: 0.75,
      reasoning: 'Advanced algorithmic analysis with CRISPR-specific heuristics (Ollama AI not available - install and run Ollama for enhanced AI insights)'
    }
  }

  private getFallbackGuideOptimization(guideSequence: string): GuideOptimizationResult {
    const gcContent = (guideSequence.match(/[CG]/g) || []).length / guideSequence.length * 100
    const hasLongRuns = /([ATCG])\1{3,}/.test(guideSequence)
    const hasPolyT = /TTTT/.test(guideSequence)
    const startsWithG = guideSequence.startsWith('G')
    const endsWithGG = guideSequence.endsWith('GG')
    
    const improvements = []
    let riskLevel = 'Low'
    
    if (gcContent < 40) {
      improvements.push('Increase GC content to 40-60% for better stability')
      riskLevel = 'Moderate'
    } else if (gcContent > 60) {
      improvements.push('Reduce GC content to avoid secondary structures')
      riskLevel = 'Moderate'
    } else {
      improvements.push('GC content is optimal (40-60%)')
    }
    
    if (hasLongRuns) {
      improvements.push('Avoid long runs of identical nucleotides (4+ in a row)')
      riskLevel = 'High'
    }
    
    if (hasPolyT) {
      improvements.push('Avoid poly-T sequences which can cause transcription termination')
      riskLevel = 'High'
    }
    
    if (!startsWithG) {
      improvements.push('Consider guides starting with G for better transcription')
    }
    
    if (endsWithGG) {
      improvements.push('Guide ends with GG - good for PAM recognition')
    }
    
    // Position-specific recommendations
    improvements.push('Validate guide position 10-20 bp upstream of PAM for optimal cutting')
    improvements.push('Check for potential off-target sites using BLAST or similar tools')
    improvements.push('Consider multiple guides targeting the same region for redundancy')
    
    const riskAssessment = `${riskLevel} risk - ${
      riskLevel === 'Low' ? 'Guide sequence appears well-optimized' :
      riskLevel === 'Moderate' ? 'Some optimization recommended before use' :
      'Significant optimization needed - consider alternative sequences'
    }`
    
    return {
      improvements,
      riskAssessment,
      confidence: 0.7
    }
  }

  private getFallbackExperimentSuggestions(experimentType: string): ExperimentSuggestion[] {
    const suggestions = {
      knockout: [
        {
          title: 'Functional Knockout Validation',
          description: 'Design multiple guides targeting different exons to confirm phenotype consistency',
          rationale: 'Multiple independent knockouts reduce off-target concerns and validate true gene function',
          priority: 'high' as const
        },
        {
          title: 'Rescue Experiment Design',
          description: 'Plan complementation experiments with wild-type gene reintroduction',
          rationale: 'Rescue experiments provide definitive proof that observed phenotypes are due to target gene loss',
          priority: 'medium' as const
        }
      ],
      knockin: [
        {
          title: 'Homology-Directed Repair Optimization',
          description: 'Test different donor template designs and delivery methods',
          rationale: 'HDR efficiency varies significantly with template design and experimental conditions',
          priority: 'high' as const
        }
      ],
      screening: [
        {
          title: 'Pooled CRISPR Screen Design',
          description: 'Design comprehensive library targeting gene family or pathway of interest',
          rationale: 'Systematic screening can reveal unexpected gene interactions and redundancies',
          priority: 'high' as const
        }
      ]
    }

    return suggestions[experimentType as keyof typeof suggestions] || suggestions.knockout
  }

  private getFallbackAnswer(question: string): string {
    return `I'd be happy to help with your CRISPR question: "${question}". However, the AI assistant is currently not available. Please check that Ollama is running locally, or consult CRISPR documentation and literature for detailed guidance. For technical questions, consider reviewing recent publications on CRISPR methodology and best practices.`
  }

  // Utility method to check if AI is available
  isAIAvailable(): boolean {
    return this.isAvailable
  }

  // Method to change model
  async setModel(modelName: string): Promise<boolean> {
    try {
      const models = await ollama.list()
      if (models.models.some(m => m.name === modelName || m.name.includes(modelName.split(':')[0]))) {
        this.model = modelName
        this.isAvailable = true
        console.log(`✅ Switched to model: ${modelName}`)
        return true
      }
      return false
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const aiService = new OllamaService()

// Initialize on module load
aiService.initialize().catch(console.error) 