import axios from 'axios'
import { VectorSearchRequest, VectorSearchResult } from '../types/processing'

export class VectorService {
  private qdrantUrl: string
  private defaultCollection: string

  constructor(qdrantUrl: string = 'http://localhost:6333', defaultCollection: string = 'nanopore_docs') {
    this.qdrantUrl = qdrantUrl
    this.defaultCollection = defaultCollection
  }

  /**
   * Initialize vector database and create collections
   */
  async initialize(): Promise<void> {
    try {
      // Check if collection exists, create if not
      const collections = await this.getCollections()
      if (!collections.includes(this.defaultCollection)) {
        await this.createCollection(this.defaultCollection)
      }
    } catch (error) {
      throw new Error(`Failed to initialize vector database: ${error}`)
    }
  }

  /**
   * Store vector embeddings in the database
   */
  async storeEmbeddings(
    embeddings: number[],
    payload: Record<string, any>,
    id?: string
  ): Promise<string> {
    try {
      const pointId = id || this.generateId()
      
      const response = await axios.put(`${this.qdrantUrl}/collections/${this.defaultCollection}/points`, {
        points: [{
          id: pointId,
          vector: embeddings,
          payload
        }]
      })

      if (response.status !== 200) {
        throw new Error(`Failed to store embeddings: ${response.statusText}`)
      }

      return pointId
    } catch (error) {
      throw new Error(`Failed to store embeddings: ${error}`)
    }
  }

  /**
   * Search for similar vectors
   */
  async searchVectors(request: VectorSearchRequest): Promise<VectorSearchResult[]> {
    try {
      const response = await axios.post(`${this.qdrantUrl}/collections/${this.defaultCollection}/points/search`, {
        vector: request.query, // This should be the query vector
        limit: request.limit,
        score_threshold: request.threshold,
        with_payload: true,
        with_vector: false,
        filter: request.filters ? this.buildFilter(request.filters) : undefined
      })

      if (response.status !== 200) {
        throw new Error(`Search failed: ${response.statusText}`)
      }

      return response.data.result.map((item: any) => ({
        id: item.id,
        score: item.score,
        payload: item.payload,
        metadata: item.payload.metadata
      }))
    } catch (error) {
      throw new Error(`Vector search failed: ${error}`)
    }
  }

  /**
   * Search by text (converts text to embeddings first)
   */
  async searchByText(
    text: string,
    embeddings: number[],
    request: VectorSearchRequest
  ): Promise<VectorSearchResult[]> {
    try {
      const response = await axios.post(`${this.qdrantUrl}/collections/${this.defaultCollection}/points/search`, {
        vector: embeddings,
        limit: request.limit,
        score_threshold: request.threshold,
        with_payload: true,
        with_vector: false,
        filter: request.filters ? this.buildFilter(request.filters) : undefined
      })

      if (response.status !== 200) {
        throw new Error(`Text search failed: ${response.statusText}`)
      }

      return response.data.result.map((item: any) => ({
        id: item.id,
        score: item.score,
        payload: item.payload,
        metadata: item.payload.metadata
      }))
    } catch (error) {
      throw new Error(`Text search failed: ${error}`)
    }
  }

  /**
   * Delete vector by ID
   */
  async deleteVector(id: string): Promise<boolean> {
    try {
      const response = await axios.delete(`${this.qdrantUrl}/collections/${this.defaultCollection}/points`, {
        data: {
          points: [id]
        }
      })

      return response.status === 200
    } catch (error) {
      console.error(`Failed to delete vector ${id}:`, error)
      return false
    }
  }

  /**
   * Update vector payload
   */
  async updateVectorPayload(
    id: string,
    payload: Record<string, any>
  ): Promise<boolean> {
    try {
      const response = await axios.put(`${this.qdrantUrl}/collections/${this.defaultCollection}/points`, {
        points: [{
          id,
          payload
        }]
      })

      return response.status === 200
    } catch (error) {
      console.error(`Failed to update vector payload for ${id}:`, error)
      return false
    }
  }

  /**
   * Get vector by ID
   */
  async getVector(id: string): Promise<VectorSearchResult | null> {
    try {
      const response = await axios.get(`${this.qdrantUrl}/collections/${this.defaultCollection}/points/${id}`)

      if (response.status !== 200) {
        return null
      }

      const point = response.data.result
      return {
        id: point.id,
        score: 1.0, // Exact match
        payload: point.payload,
        metadata: point.payload.metadata
      }
    } catch (error) {
      console.error(`Failed to get vector ${id}:`, error)
      return null
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<{
    totalPoints: number
    vectorSize: number
    indexedVectors: number
  }> {
    try {
      const response = await axios.get(`${this.qdrantUrl}/collections/${this.defaultCollection}`)

      if (response.status !== 200) {
        throw new Error(`Failed to get collection stats: ${response.statusText}`)
      }

      const collection = response.data.result
      return {
        totalPoints: collection.points_count,
        vectorSize: collection.config.params.vectors.size,
        indexedVectors: collection.indexed_vectors_count
      }
    } catch (error) {
      throw new Error(`Failed to get collection stats: ${error}`)
    }
  }

  /**
   * Create a new collection
   */
  async createCollection(collectionName: string): Promise<boolean> {
    try {
      const response = await axios.put(`${this.qdrantUrl}/collections/${collectionName}`, {
        vectors: {
          size: 1536, // OpenAI embedding dimension
          distance: 'Cosine'
        },
        optimizers_config: {
          default_segment_number: 2
        },
        replication_factor: 1
      })

      return response.status === 200
    } catch (error) {
      console.error(`Failed to create collection ${collectionName}:`, error)
      return false
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName: string): Promise<boolean> {
    try {
      const response = await axios.delete(`${this.qdrantUrl}/collections/${collectionName}`)
      return response.status === 200
    } catch (error) {
      console.error(`Failed to delete collection ${collectionName}:`, error)
      return false
    }
  }

  /**
   * Get all collections
   */
  async getCollections(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.qdrantUrl}/collections`)
      
      if (response.status !== 200) {
        throw new Error(`Failed to get collections: ${response.statusText}`)
      }

      return response.data.result.collections.map((collection: any) => collection.name)
    } catch (error) {
      console.error('Failed to get collections:', error)
      return []
    }
  }

  /**
   * Batch store multiple embeddings
   */
  async batchStoreEmbeddings(
    embeddings: Array<{
      id?: string
      vector: number[]
      payload: Record<string, any>
    }>
  ): Promise<string[]> {
    try {
      const points = embeddings.map(item => ({
        id: item.id || this.generateId(),
        vector: item.vector,
        payload: item.payload
      }))

      const response = await axios.put(`${this.qdrantUrl}/collections/${this.defaultCollection}/points`, {
        points
      })

      if (response.status !== 200) {
        throw new Error(`Batch store failed: ${response.statusText}`)
      }

      return points.map(point => point.id)
    } catch (error) {
      throw new Error(`Batch store failed: ${error}`)
    }
  }

  /**
   * Search with filters
   */
  async searchWithFilters(
    embeddings: number[],
    filters: Record<string, any>,
    limit: number = 10,
    threshold: number = 0.7
  ): Promise<VectorSearchResult[]> {
    try {
      const response = await axios.post(`${this.qdrantUrl}/collections/${this.defaultCollection}/points/search`, {
        vector: embeddings,
        limit,
        score_threshold: threshold,
        with_payload: true,
        with_vector: false,
        filter: this.buildFilter(filters)
      })

      if (response.status !== 200) {
        throw new Error(`Filtered search failed: ${response.statusText}`)
      }

      return response.data.result.map((item: any) => ({
        id: item.id,
        score: item.score,
        payload: item.payload,
        metadata: item.payload.metadata
      }))
    } catch (error) {
      throw new Error(`Filtered search failed: ${error}`)
    }
  }

  /**
   * Health check for Qdrant service
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.qdrantUrl}/collections`, { timeout: 5000 })
      return response.status === 200
    } catch (error) {
      return false
    }
  }

  /**
   * Build Qdrant filter from generic filters
   */
  private buildFilter(filters: Record<string, any>): any {
    const conditions: any[] = []

    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        conditions.push({
          key: `payload.${key}`,
          match: {
            any: value
          }
        })
      } else if (typeof value === 'object') {
        // Handle range queries
        if (value.gte !== undefined || value.lte !== undefined) {
          const range: any = {}
          if (value.gte !== undefined) range.gte = value.gte
          if (value.lte !== undefined) range.lte = value.lte
          
          conditions.push({
            key: `payload.${key}`,
            range
          })
        }
      } else {
        conditions.push({
          key: `payload.${key}`,
          match: {
            value
          }
        })
      }
    }

    return conditions.length > 0 ? { must: conditions } : undefined
  }

  /**
   * Generate unique ID for vector points
   */
  private generateId(): string {
    return `vec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(collectionName?: string): Promise<any> {
    try {
      const name = collectionName || this.defaultCollection
      const response = await axios.get(`${this.qdrantUrl}/collections/${name}`)
      
      if (response.status !== 200) {
        throw new Error(`Failed to get collection info: ${response.statusText}`)
      }

      return response.data.result
    } catch (error) {
      throw new Error(`Failed to get collection info: ${error}`)
    }
  }

  /**
   * Optimize collection for better performance
   */
  async optimizeCollection(collectionName?: string): Promise<boolean> {
    try {
      const name = collectionName || this.defaultCollection
      const response = await axios.post(`${this.qdrantUrl}/collections/${name}/optimize`)
      return response.status === 200
    } catch (error) {
      console.error('Failed to optimize collection:', error)
      return false
    }
  }

  /**
   * Create index for better search performance
   */
  async createIndex(
    collectionName?: string,
    indexType: 'IVF' | 'HNSW' = 'HNSW'
  ): Promise<boolean> {
    try {
      const name = collectionName || this.defaultCollection
      const response = await axios.put(`${this.qdrantUrl}/collections/${name}/index`, {
        field_name: 'vector',
        field_schema: indexType === 'HNSW' ? 'HNSW' : 'IVF'
      })
      return response.status === 200
    } catch (error) {
      console.error('Failed to create index:', error)
      return false
    }
  }
}