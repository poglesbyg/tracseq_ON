import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle, FileText } from 'lucide-react'
import { useState, useCallback } from 'react'

import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { Separator } from '../ui/separator'

import { AISequenceAnalyzer } from './ai-sequence-analyzer'

interface SequenceInputProps {
  onSequenceSubmit: (
    sequence: string,
    name: string,
    type: 'genomic' | 'cdna' | 'custom',
  ) => void
  isLoading?: boolean
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    length: number
    gcContent: number
    composition: { A: number; T: number; C: number; G: number; N: number }
  }
}

export function SequenceInput({
  onSequenceSubmit,
  isLoading = false,
}: SequenceInputProps) {
  const [sequence, setSequence] = useState('')
  const [sequenceName, setSequenceName] = useState('')
  const [sequenceType, setSequenceType] = useState<
    'genomic' | 'cdna' | 'custom'
  >('genomic')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [inputMethod, setInputMethod] = useState<'paste' | 'fasta'>('paste')

  const validateSequence = useCallback((seq: string): ValidationResult => {
    const cleanSeq = seq.toUpperCase().replace(/\s+/g, '')
    const errors: string[] = []
    const warnings: string[] = []

    // Basic validation
    if (cleanSeq.length === 0) {
      errors.push('Sequence cannot be empty')
    }

    if (cleanSeq.length < 50) {
      warnings.push(
        'Sequence is very short (< 50bp). Consider longer sequences for better guide design.',
      )
    }

    if (cleanSeq.length > 10000) {
      warnings.push(
        'Sequence is very long (> 10kb). Processing may take longer.',
      )
    }

    // Character validation
    const validChars = /^[ACGNT]+$/
    if (!validChars.test(cleanSeq)) {
      errors.push(
        'Sequence contains invalid characters. Only A, T, C, G, and N are allowed.',
      )
    }

    // Calculate composition
    const composition = {
      A: (cleanSeq.match(/A/g) || []).length,
      T: (cleanSeq.match(/T/g) || []).length,
      C: (cleanSeq.match(/C/g) || []).length,
      G: (cleanSeq.match(/G/g) || []).length,
      N: (cleanSeq.match(/N/g) || []).length,
    }

    const gcContent =
      cleanSeq.length > 0
        ? ((composition.C + composition.G) / cleanSeq.length) * 100
        : 0

    // GC content warnings
    if (gcContent < 20) {
      warnings.push(
        'Low GC content (< 20%). This may affect guide RNA efficiency.',
      )
    } else if (gcContent > 80) {
      warnings.push(
        'High GC content (> 80%). This may affect guide RNA efficiency.',
      )
    }

    // N content warning
    const nPercent = (composition.N / cleanSeq.length) * 100
    if (nPercent > 5) {
      warnings.push(
        'High N content (> 5%). Consider resolving ambiguous nucleotides.',
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        length: cleanSeq.length,
        gcContent,
        composition,
      },
    }
  }, [])

  const handleSequenceChange = (value: string) => {
    setSequence(value)
    if (value.trim()) {
      const result = validateSequence(value)
      setValidation(result)
    } else {
      setValidation(null)
    }
  }

  const parseFastaSequence = (fastaText: string) => {
    const lines = fastaText.trim().split('\n')
    if (lines[0].startsWith('>')) {
      // Extract name from FASTA header
      const header = lines[0].substring(1).trim()
      setSequenceName(header.split(' ')[0] || 'Imported Sequence')
      // Join sequence lines
      const seq = lines.slice(1).join('')
      handleSequenceChange(seq)
    } else {
      // Not FASTA format, treat as raw sequence
      handleSequenceChange(fastaText)
    }
  }

  const handleSubmit = () => {
    if (validation?.isValid && sequence.trim() && sequenceName.trim()) {
      const cleanSeq = sequence.toUpperCase().replace(/\s+/g, '')
      onSequenceSubmit(cleanSeq, sequenceName, sequenceType)
    }
  }

  const loadExample = () => {
    const exampleSequence =
      'ATGAAGTTCCTGATCCAGGACATCAAGAACAATGCCGATTTCTTCGATGGAGAAGATGCTAAAGAGGACTTGGATAACAAGTGTAACCTGTCCGAGTGCAAGTTCAAGGGAATGACCGAGTGCTTCCAGGAGAACATGGATCGTTATGTGGACGAGATTCTGAAGAGCGAGAAAAAGGAGTACTTCAATCTGAGCGACGGCGCCTATGGCGTGGACGAGAAGTTCTATTTCGTGAAGGATGGCAGATTTGCCAAGATGGATGATGAGTACTTCGTGAATGGCGAAGATCTGGTGTATAACCTGACCGATACCAAGTGCCATGCGTACATGGAAGATTATGGCTATGATGTGGATACCGATCCCCAGGAGTGTTATGAAGATAGCTATGATGATGATGATGATTAA'
    setSequenceName('Human GRIN1 Exon 3 (Example)')
    setSequenceType('genomic')
    handleSequenceChange(exampleSequence)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card className="bg-white/5 border-white/20 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Sequence Input</span>
          </CardTitle>
          <CardDescription className="text-slate-400">
            Enter your target DNA sequence for guide RNA design
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Method Selection */}
          <div className="flex space-x-1 bg-black/20 rounded-lg p-1">
            <button
              onClick={() => setInputMethod('paste')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                inputMethod === 'paste'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              Direct Input
            </button>
            <button
              onClick={() => setInputMethod('fasta')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                inputMethod === 'fasta'
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              FASTA Format
            </button>
          </div>

          {/* Sequence Name Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Sequence Name
            </label>
            <input
              type="text"
              value={sequenceName}
              onChange={(e) => setSequenceName(e.target.value)}
              placeholder="Enter a name for your sequence"
              className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/15 focus:border-purple-400 transition-all duration-200"
            />
          </div>

          {/* Sequence Type Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Sequence Type
            </label>
            <select
              value={sequenceType}
              onChange={(e) =>
                setSequenceType(e.target.value as 'genomic' | 'cdna' | 'custom')
              }
              className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/15 focus:border-purple-400 transition-all duration-200"
            >
              <option value="genomic">Genomic DNA</option>
              <option value="cdna">cDNA</option>
              <option value="custom">Custom Sequence</option>
            </select>
          </div>

          {/* Sequence Input Area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-300">
                {inputMethod === 'fasta' ? 'FASTA Sequence' : 'DNA Sequence'}
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={loadExample}
                className="border-white/30 bg-white/5 text-slate-300 hover:bg-white/20 hover:border-white/40 transition-all duration-200"
              >
                Load Example
              </Button>
            </div>
            <textarea
              value={sequence}
              onChange={(e) =>
                inputMethod === 'fasta'
                  ? parseFastaSequence(e.target.value)
                  : handleSequenceChange(e.target.value)
              }
              placeholder={
                inputMethod === 'fasta'
                  ? '>sequence_name\nATCGATCGATCG...'
                  : 'ATCGATCGATCG...'
              }
              rows={6}
              className="w-full px-3 py-2 bg-white/10 border border-white/30 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/15 focus:border-purple-400 transition-all duration-200 font-mono text-sm"
            />
          </div>

          {/* Validation Results */}
          {validation && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <Separator className="bg-white/10" />

              {/* Validation Status */}
              <div className="flex items-center space-x-2">
                {validation.isValid ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 font-medium">
                      Sequence Valid
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <span className="text-red-400 font-medium">
                      Validation Issues
                    </span>
                  </>
                )}
              </div>

              {/* Errors */}
              {validation.errors.length > 0 && (
                <div className="space-y-1">
                  {validation.errors.map((error, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 text-red-400 text-sm"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span>{error}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div className="space-y-1">
                  {validation.warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-2 text-yellow-400 text-sm"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white/10 border border-white/20 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">
                    {validation.stats.length}
                  </div>
                  <div className="text-xs text-slate-400">Length (bp)</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white">
                    {validation.stats.gcContent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-400">GC Content</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">
                    {validation.stats.composition.A +
                      validation.stats.composition.T}
                  </div>
                  <div className="text-xs text-slate-400">A+T Count</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {validation.stats.composition.C +
                      validation.stats.composition.G}
                  </div>
                  <div className="text-xs text-slate-400">C+G Count</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!validation?.isValid || !sequenceName.trim() || isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Analyzing Sequence...</span>
              </div>
            ) : (
              'Design Guide RNAs'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* AI Sequence Analysis */}
      {sequence && sequence.length >= 20 && (
        <AISequenceAnalyzer
          sequence={sequence}
          context={`Sequence Name: ${sequenceName}, Type: ${sequenceType}`}
        />
      )}
    </motion.div>
  )
}
