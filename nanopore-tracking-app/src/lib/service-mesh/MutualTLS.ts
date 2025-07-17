import { getComponentLogger } from '../logging/StructuredLogger'
import { randomUUID } from 'crypto'

const logger = getComponentLogger('MutualTLS')

/**
 * Certificate information
 */
export interface Certificate {
  id: string
  commonName: string
  organization: string
  organizationalUnit: string
  country: string
  validFrom: Date
  validTo: Date
  serialNumber: string
  fingerprint: string
  publicKey: string
  privateKey?: string
  certificateChain: string[]
  isCA: boolean
  keyUsage: string[]
  extendedKeyUsage: string[]
}

/**
 * Certificate signing request
 */
export interface CertificateSigningRequest {
  id: string
  commonName: string
  organization: string
  organizationalUnit: string
  country: string
  subjectAlternativeNames: string[]
  keySize: number
  validityDays: number
  keyUsage: string[]
  extendedKeyUsage: string[]
}

/**
 * TLS configuration
 */
export interface TLSConfig {
  enabled: boolean
  enforceClientCerts: boolean
  allowedCertificates: string[]
  trustedCAs: string[]
  certificateValidityDays: number
  keySize: number
  cipherSuites: string[]
  protocols: string[]
  verifyPeerCertificate: boolean
  requireSAN: boolean
}

/**
 * Certificate validation result
 */
export interface CertificateValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  certificate: Certificate
  chain: Certificate[]
  trustPath: string[]
}

/**
 * Mutual TLS manager for service mesh
 */
export class MutualTLSManager {
  private certificates: Map<string, Certificate> = new Map()
  private trustedCAs: Map<string, Certificate> = new Map()
  private certificateRevocationList: Set<string> = new Set()
  private config: TLSConfig
  private certificateRotationTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(config: TLSConfig) {
    this.config = config
    this.initializeMutualTLS()
  }

  /**
   * Initialize mutual TLS
   */
  private initializeMutualTLS(): void {
    logger.info('Initializing mutual TLS', {
      action: 'initialize_mutual_tls',
      metadata: {
        enabled: this.config.enabled,
        enforceClientCerts: this.config.enforceClientCerts,
        trustedCAs: this.config.trustedCAs.length
      }
    })

    if (this.config.enabled) {
      // Load trusted CAs
      this.loadTrustedCAs()
      
      // Start certificate rotation monitoring
      this.startCertificateRotationMonitoring()
      
      // Initialize root CA if needed
      this.initializeRootCA()
    }
  }

  /**
   * Generate certificate signing request
   */
  generateCSR(request: CertificateSigningRequest): string {
    logger.info('Generating certificate signing request', {
      action: 'generate_csr',
      metadata: {
        csrId: request.id,
        commonName: request.commonName,
        organization: request.organization,
        keySize: request.keySize,
        validityDays: request.validityDays
      }
    })

    // In a real implementation, this would use a crypto library like node-forge
    // For this example, we'll simulate CSR generation
    const csr = this.simulateCSRGeneration(request)
    
    return csr
  }

  /**
   * Sign certificate
   */
  signCertificate(csr: string, caId: string): Certificate {
    const ca = this.trustedCAs.get(caId)
    if (!ca) {
      throw new Error(`CA not found: ${caId}`)
    }

    if (!ca.isCA) {
      throw new Error(`Certificate is not a CA: ${caId}`)
    }

    logger.info('Signing certificate', {
      action: 'sign_certificate',
      metadata: {
        caId,
        caCommonName: ca.commonName
      }
    })

    // Parse CSR and generate certificate
    const certificate = this.simulateCertificateGeneration(csr, ca)
    
    // Store certificate
    this.certificates.set(certificate.id, certificate)
    
    // Schedule certificate rotation
    this.scheduleCertificateRotation(certificate)
    
    return certificate
  }

  /**
   * Validate certificate
   */
  validateCertificate(certificateId: string): CertificateValidationResult {
    const certificate = this.certificates.get(certificateId)
    if (!certificate) {
      return {
        valid: false,
        errors: ['Certificate not found'],
        warnings: [],
        certificate: {} as Certificate,
        chain: [],
        trustPath: []
      }
    }

    const errors: string[] = []
    const warnings: string[] = []
    const chain: Certificate[] = []
    const trustPath: string[] = []

    // Check if certificate is revoked
    if (this.certificateRevocationList.has(certificate.fingerprint)) {
      errors.push('Certificate is revoked')
    }

    // Check validity period
    const now = new Date()
    if (certificate.validFrom > now) {
      errors.push('Certificate is not yet valid')
    }
    if (certificate.validTo < now) {
      errors.push('Certificate has expired')
    }

    // Check if expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (certificate.validTo < thirtyDaysFromNow) {
      warnings.push('Certificate expires within 30 days')
    }

    // Build certificate chain
    this.buildCertificateChain(certificate, chain, trustPath)

    // Validate certificate chain
    if (!this.validateCertificateChain(chain)) {
      errors.push('Invalid certificate chain')
    }

    logger.debug('Certificate validation completed', {
      action: 'validate_certificate',
      metadata: {
        certificateId,
        commonName: certificate.commonName,
        valid: errors.length === 0,
        errors: errors.length,
        warnings: warnings.length
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      certificate,
      chain,
      trustPath
    }
  }

  /**
   * Revoke certificate
   */
  revokeCertificate(certificateId: string, reason: string): void {
    const certificate = this.certificates.get(certificateId)
    if (!certificate) {
      throw new Error(`Certificate not found: ${certificateId}`)
    }

    this.certificateRevocationList.add(certificate.fingerprint)
    
    // Cancel rotation timer
    const timer = this.certificateRotationTimers.get(certificateId)
    if (timer) {
      clearTimeout(timer)
      this.certificateRotationTimers.delete(certificateId)
    }

    logger.warn('Certificate revoked', {
      action: 'revoke_certificate',
      metadata: {
        certificateId,
        commonName: certificate.commonName,
        reason
      }
    })
  }

  /**
   * Rotate certificate
   */
  async rotateCertificate(certificateId: string): Promise<Certificate> {
    const oldCertificate = this.certificates.get(certificateId)
    if (!oldCertificate) {
      throw new Error(`Certificate not found: ${certificateId}`)
    }

    logger.info('Rotating certificate', {
      action: 'rotate_certificate',
      metadata: {
        certificateId,
        commonName: oldCertificate.commonName,
        expiresAt: oldCertificate.validTo
      }
    })

    // Generate new CSR
    const csrRequest: CertificateSigningRequest = {
      id: randomUUID(),
      commonName: oldCertificate.commonName,
      organization: oldCertificate.organization,
      organizationalUnit: oldCertificate.organizationalUnit,
      country: oldCertificate.country,
      subjectAlternativeNames: [],
      keySize: this.config.keySize,
      validityDays: this.config.certificateValidityDays,
      keyUsage: oldCertificate.keyUsage,
      extendedKeyUsage: oldCertificate.extendedKeyUsage
    }

    const csr = this.generateCSR(csrRequest)
    
    // Find appropriate CA
    const caId = this.findSigningCA(oldCertificate)
    
    // Sign new certificate
    const newCertificate = this.signCertificate(csr, caId)
    
    // Replace old certificate
    this.certificates.set(certificateId, newCertificate)
    
    // Revoke old certificate
    this.certificateRevocationList.add(oldCertificate.fingerprint)
    
    return newCertificate
  }

  /**
   * Verify TLS handshake
   */
  verifyTLSHandshake(
    clientCertificateId: string,
    serverCertificateId: string,
    cipherSuite: string,
    protocol: string
  ): { success: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate cipher suite
    if (!this.config.cipherSuites.includes(cipherSuite)) {
      errors.push(`Unsupported cipher suite: ${cipherSuite}`)
    }

    // Validate protocol
    if (!this.config.protocols.includes(protocol)) {
      errors.push(`Unsupported protocol: ${protocol}`)
    }

    // Validate client certificate
    if (this.config.enforceClientCerts) {
      const clientValidation = this.validateCertificate(clientCertificateId)
      if (!clientValidation.valid) {
        errors.push(`Client certificate validation failed: ${clientValidation.errors.join(', ')}`)
      }
    }

    // Validate server certificate
    const serverValidation = this.validateCertificate(serverCertificateId)
    if (!serverValidation.valid) {
      errors.push(`Server certificate validation failed: ${serverValidation.errors.join(', ')}`)
    }

    const success = errors.length === 0

    logger.debug('TLS handshake verification completed', {
      action: 'verify_tls_handshake',
      metadata: {
        clientCertificateId,
        serverCertificateId,
        cipherSuite,
        protocol,
        success,
        errors: errors.length
      }
    })

    return { success, errors }
  }

  /**
   * Get certificate by common name
   */
  getCertificateByCommonName(commonName: string): Certificate | null {
    for (const certificate of this.certificates.values()) {
      if (certificate.commonName === commonName) {
        return certificate
      }
    }
    return null
  }

  /**
   * Get all certificates
   */
  getAllCertificates(): Certificate[] {
    return Array.from(this.certificates.values())
  }

  /**
   * Get trusted CAs
   */
  getTrustedCAs(): Certificate[] {
    return Array.from(this.trustedCAs.values())
  }

  /**
   * Get certificate revocation list
   */
  getCertificateRevocationList(): string[] {
    return Array.from(this.certificateRevocationList)
  }

  /**
   * Load trusted CAs
   */
  private loadTrustedCAs(): void {
    // In a real implementation, this would load CA certificates from files or a certificate store
    // For this example, we'll create a self-signed root CA
    const rootCA = this.createRootCA()
    this.trustedCAs.set(rootCA.id, rootCA)
    
    logger.info('Trusted CAs loaded', {
      action: 'load_trusted_cas',
      metadata: {
        count: this.trustedCAs.size
      }
    })
  }

  /**
   * Create root CA
   */
  private createRootCA(): Certificate {
    const rootCA: Certificate = {
      id: randomUUID(),
      commonName: 'Nanopore Service Mesh Root CA',
      organization: 'Nanopore Tracking',
      organizationalUnit: 'Service Mesh',
      country: 'US',
      validFrom: new Date(),
      validTo: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
      serialNumber: '1',
      fingerprint: this.generateFingerprint(),
      publicKey: this.generatePublicKey(),
      privateKey: this.generatePrivateKey(),
      certificateChain: [],
      isCA: true,
      keyUsage: ['keyCertSign', 'cRLSign'],
      extendedKeyUsage: []
    }

    logger.info('Root CA created', {
      action: 'create_root_ca',
      metadata: {
        commonName: rootCA.commonName,
        validFrom: rootCA.validFrom,
        validTo: rootCA.validTo
      }
    })

    return rootCA
  }

  /**
   * Initialize root CA
   */
  private initializeRootCA(): void {
    if (this.trustedCAs.size === 0) {
      const rootCA = this.createRootCA()
      this.trustedCAs.set(rootCA.id, rootCA)
    }
  }

  /**
   * Start certificate rotation monitoring
   */
  private startCertificateRotationMonitoring(): void {
    setInterval(() => {
      this.checkCertificateExpiration()
    }, 24 * 60 * 60 * 1000) // Check daily
  }

  /**
   * Check certificate expiration
   */
  private checkCertificateExpiration(): void {
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    for (const [id, certificate] of this.certificates.entries()) {
      if (certificate.validTo < thirtyDaysFromNow) {
        logger.warn('Certificate expiring soon', {
          action: 'certificate_expiring',
          metadata: {
            certificateId: id,
            commonName: certificate.commonName,
            expiresAt: certificate.validTo
          }
        })

        // Auto-rotate if enabled
        this.rotateCertificate(id).catch(error => {
          logger.error('Failed to rotate certificate', {
            action: 'certificate_rotation_failed',
            metadata: {
              certificateId: id,
              errorMessage: error.message
            }
          })
        })
      }
    }
  }

  /**
   * Schedule certificate rotation
   */
  private scheduleCertificateRotation(certificate: Certificate): void {
    const rotationTime = new Date(certificate.validTo.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days before expiration
    const delay = rotationTime.getTime() - Date.now()

    if (delay > 0) {
      const timer = setTimeout(() => {
        this.rotateCertificate(certificate.id).catch(error => {
          logger.error('Scheduled certificate rotation failed', {
            action: 'scheduled_rotation_failed',
            metadata: {
              certificateId: certificate.id,
              errorMessage: error.message
            }
          })
        })
      }, delay)

      this.certificateRotationTimers.set(certificate.id, timer)
    }
  }

  /**
   * Build certificate chain
   */
  private buildCertificateChain(certificate: Certificate, chain: Certificate[], trustPath: string[]): void {
    chain.push(certificate)
    trustPath.push(certificate.commonName)

    // Find issuer (simplified - in real implementation would parse certificate issuer)
    for (const ca of this.trustedCAs.values()) {
      if (ca.isCA && ca.id !== certificate.id) {
        chain.push(ca)
        trustPath.push(ca.commonName)
        break
      }
    }
  }

  /**
   * Validate certificate chain
   */
  private validateCertificateChain(chain: Certificate[]): boolean {
    if (chain.length === 0) return false

    // Check if chain ends with a trusted CA
    const rootCert = chain[chain.length - 1]
    return rootCert ? this.trustedCAs.has(rootCert.id) : false
  }

  /**
   * Find signing CA
   */
  private findSigningCA(certificate: Certificate): string {
    // Find the first available CA
    for (const ca of this.trustedCAs.values()) {
      if (ca.isCA) {
        return ca.id
      }
    }
    throw new Error('No signing CA available')
  }

  /**
   * Simulate CSR generation
   */
  private simulateCSRGeneration(request: CertificateSigningRequest): string {
    return `-----BEGIN CERTIFICATE REQUEST-----
CSR_ID: ${request.id}
CN: ${request.commonName}
O: ${request.organization}
OU: ${request.organizationalUnit}
C: ${request.country}
KEY_SIZE: ${request.keySize}
VALIDITY_DAYS: ${request.validityDays}
-----END CERTIFICATE REQUEST-----`
  }

  /**
   * Simulate certificate generation
   */
  private simulateCertificateGeneration(csr: string, ca: Certificate): Certificate {
    // Parse CSR (simplified)
    const lines = csr.split('\n')
    const csrId = lines.find(line => line.startsWith('CSR_ID:'))?.split(': ')[1] || randomUUID()
    const commonName = lines.find(line => line.startsWith('CN:'))?.split(': ')[1] || 'unknown'
    const organization = lines.find(line => line.startsWith('O:'))?.split(': ')[1] || 'unknown'
    const organizationalUnit = lines.find(line => line.startsWith('OU:'))?.split(': ')[1] || 'unknown'
    const country = lines.find(line => line.startsWith('C:'))?.split(': ')[1] || 'US'

    return {
      id: randomUUID(),
      commonName,
      organization,
      organizationalUnit,
      country,
      validFrom: new Date(),
      validTo: new Date(Date.now() + this.config.certificateValidityDays * 24 * 60 * 60 * 1000),
      serialNumber: Math.floor(Math.random() * 1000000).toString(),
      fingerprint: this.generateFingerprint(),
      publicKey: this.generatePublicKey(),
      certificateChain: [ca.fingerprint],
      isCA: false,
      keyUsage: ['digitalSignature', 'keyEncipherment'],
      extendedKeyUsage: ['serverAuth', 'clientAuth']
    }
  }

  /**
   * Generate fingerprint
   */
  private generateFingerprint(): string {
    return randomUUID().replace(/-/g, '').substring(0, 32)
  }

  /**
   * Generate public key
   */
  private generatePublicKey(): string {
    return `-----BEGIN PUBLIC KEY-----
${randomUUID().replace(/-/g, '')}
-----END PUBLIC KEY-----`
  }

  /**
   * Generate private key
   */
  private generatePrivateKey(): string {
    return `-----BEGIN PRIVATE KEY-----
${randomUUID().replace(/-/g, '')}
-----END PRIVATE KEY-----`
  }

  /**
   * Shutdown mutual TLS
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down mutual TLS', {
      action: 'shutdown_mutual_tls'
    })

    // Clear all rotation timers
    for (const timer of this.certificateRotationTimers.values()) {
      clearTimeout(timer)
    }
    this.certificateRotationTimers.clear()
  }
}

/**
 * Default mutual TLS configurations
 */
export const defaultMutualTLSConfigs = {
  production: {
    enabled: true,
    enforceClientCerts: true,
    allowedCertificates: [],
    trustedCAs: [],
    certificateValidityDays: 365,
    keySize: 2048,
    cipherSuites: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256'
    ],
    protocols: ['TLSv1.2', 'TLSv1.3'],
    verifyPeerCertificate: true,
    requireSAN: true
  },
  
  development: {
    enabled: false,
    enforceClientCerts: false,
    allowedCertificates: [],
    trustedCAs: [],
    certificateValidityDays: 90,
    keySize: 2048,
    cipherSuites: [
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384'
    ],
    protocols: ['TLSv1.2', 'TLSv1.3'],
    verifyPeerCertificate: false,
    requireSAN: false
  }
} 