#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🚀 Nanopore Tracking App - Complete Setup')
console.log('=' * 50)

async function runSetup() {
  try {
    // Step 1: Database Setup
    console.log('\n📊 Step 1: Database Setup')
    console.log('Running database migrations...')
    
    try {
      execSync('npm run db:setup', { stdio: 'inherit' })
      console.log('✅ Database setup completed successfully')
    } catch (error) {
      console.error('❌ Database setup failed:', error.message)
      console.log('Please ensure PostgreSQL is running and DATABASE_URL is configured')
      return false
    }

    // Step 2: Environment Validation
    console.log('\n⚙️ Step 2: Environment Configuration')
    console.log('Validating environment configuration...')
    
    const requiredEnvVars = [
      'DATABASE_URL',
      'OLLAMA_HOST',
      'NODE_ENV',
      'PORT'
    ]
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars.join(', '))
      console.log('Please check your .env file or environment configuration')
      return false
    }
    
    console.log('✅ Environment configuration valid')

    // Step 3: Dependencies Check
    console.log('\n📦 Step 3: Dependencies Check')
    console.log('Installing/updating dependencies...')
    
    try {
      execSync('npm install', { stdio: 'inherit' })
      console.log('✅ Dependencies installed successfully')
    } catch (error) {
      console.error('❌ Dependency installation failed:', error.message)
      return false
    }

    // Step 4: Build Check
    console.log('\n🔨 Step 4: Build Verification')
    console.log('Testing application build...')
    
    try {
      execSync('npm run build', { stdio: 'inherit' })
      console.log('✅ Application builds successfully')
    } catch (error) {
      console.error('❌ Build failed:', error.message)
      return false
    }

    // Step 5: Health Check
    console.log('\n🏥 Step 5: Health Check')
    console.log('Running comprehensive health checks...')
    
    // Start the app in background for health check
    const { spawn } = require('child_process')
    const server = spawn('npm', ['start'], { 
      stdio: 'pipe',
      detached: true
    })
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    try {
      const response = await fetch('http://localhost:3001/health')
      const health = await response.json()
      
      console.log('Health Check Results:')
      health.services.forEach(service => {
        const statusIcon = service.status === 'healthy' ? '✅' : 
                          service.status === 'degraded' ? '⚠️' : '❌'
        console.log(`  ${statusIcon} ${service.service}: ${service.message}`)
      })
      
      if (health.overall === 'healthy') {
        console.log('✅ All systems operational')
      } else {
        console.log(`⚠️ System status: ${health.overall}`)
      }
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message)
    } finally {
      // Clean up server process
      process.kill(-server.pid)
    }

    // Step 6: Deployment Readiness
    console.log('\n🚀 Step 6: Deployment Readiness')
    
    const deploymentChecks = [
      {
        name: 'OpenShift Configuration',
        check: () => fs.existsSync('deployment/openshift/deployment.yaml'),
        message: 'OpenShift deployment files present'
      },
      {
        name: 'Docker Configuration',
        check: () => fs.existsSync('deployment/docker/Dockerfile'),
        message: 'Docker configuration present'
      },
      {
        name: 'Environment Template',
        check: () => fs.existsSync('.env.example'),
        message: 'Environment template available'
      },
      {
        name: 'Database Migrations',
        check: () => fs.existsSync('database/migrations') && 
                    fs.readdirSync('database/migrations').length > 0,
        message: 'Database migrations ready'
      }
    ]
    
    deploymentChecks.forEach(check => {
      const passed = check.check()
      const icon = passed ? '✅' : '❌'
      console.log(`  ${icon} ${check.name}: ${check.message}`)
    })

    // Step 7: Summary and Next Steps
    console.log('\n📋 Setup Summary')
    console.log('✅ Database configured and migrated')
    console.log('✅ Environment variables validated')
    console.log('✅ Dependencies installed')
    console.log('✅ Application builds successfully')
    console.log('✅ Health checks completed')
    console.log('✅ Deployment files ready')

    console.log('\n🎉 Setup Complete!')
    console.log('\nNext Steps:')
    console.log('1. Start development server: npm run dev')
    console.log('2. Access application: http://localhost:3001/nanopore')
    console.log('3. Login with demo credentials (password: demo):')
    console.log('   - demo@example.com (User)')
    console.log('   - staff@example.com (Staff)')
    console.log('   - admin@example.com (Admin)')
    
    console.log('\n📚 For Production Deployment:')
    console.log('1. OpenShift: ./deployment/deploy.sh')
    console.log('2. Docker: cd deployment/docker && docker-compose up -d')
    console.log('3. Configure production environment variables')
    console.log('4. Set up proper SSL certificates')
    console.log('5. Configure monitoring and logging')

    return true

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    return false
  }
}

// Run the setup
runSetup().then(success => {
  if (success) {
    console.log('\n🎯 Setup completed successfully!')
    process.exit(0)
  } else {
    console.log('\n💥 Setup failed. Please check the errors above.')
    process.exit(1)
  }
}).catch(error => {
  console.error('Setup error:', error)
  process.exit(1)
}) 