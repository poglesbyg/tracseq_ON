import { test, expect } from '@playwright/test'
import { AuthHelper } from '../utils/test-helpers'

test.describe('Authentication Flow', () => {
  test('should display login form on initial visit', async ({ page }) => {
    await page.goto('/nanopore')
    
    // Verify login form elements
    await expect(page.locator('text=Nanopore Tracking')).toBeVisible()
    await expect(page.locator('text=Sign In')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show demo accounts section', async ({ page }) => {
    await page.goto('/nanopore')
    
    // Verify demo accounts section
    await expect(page.locator('text=Demo Accounts')).toBeVisible()
    await expect(page.locator('text=Demo User')).toBeVisible()
    await expect(page.locator('text=Staff Member')).toBeVisible()
    await expect(page.locator('text=Administrator')).toBeVisible()
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    const auth = new AuthHelper(page)
    
    await auth.login('demo@example.com', 'demo')
    
    // Verify successful login
    await expect(page.locator('text=Nanopore Tracking')).toBeVisible()
    await expect(page.locator('text=Demo User')).toBeVisible() // User menu
    await expect(page.locator('text=New Sample')).toBeVisible()
  })

  test('should fail login with invalid credentials', async ({ page }) => {
    await page.goto('/nanopore')
    
    // Fill invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    
    // Verify error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible()
    
    // Verify still on login page
    await expect(page.locator('text=Sign In')).toBeVisible()
  })

  test('should login with demo account buttons', async ({ page }) => {
    await page.goto('/nanopore')
    
    // Click demo user button
    await page.click('text=Demo User')
    
    // Verify email is filled
    await expect(page.locator('input[type="email"]')).toHaveValue('demo@example.com')
    await expect(page.locator('input[type="password"]')).toHaveValue('demo')
    
    // Submit login
    await page.click('button[type="submit"]')
    
    // Verify successful login
    await expect(page.locator('text=Welcome back, Demo User!')).toBeVisible()
  })

  test('should logout successfully', async ({ page }) => {
    const auth = new AuthHelper(page)
    
    // Login first
    await auth.login()
    
    // Logout
    await auth.logout()
    
    // Verify logout
    await expect(page.locator('text=Sign In')).toBeVisible()
    await expect(page.locator('text=Logged out successfully')).toBeVisible()
  })

  test('should maintain session across page reloads', async ({ page }) => {
    const auth = new AuthHelper(page)
    
    // Login
    await auth.login()
    
    // Reload page
    await page.reload()
    
    // Verify still logged in
    await expect(page.locator('text=Demo User')).toBeVisible()
    await expect(page.locator('text=New Sample')).toBeVisible()
  })

  test('should redirect to login when accessing protected routes without authentication', async ({ page }) => {
    // Try to access dashboard directly without login
    await page.goto('/nanopore')
    
    // Should show login form
    await expect(page.locator('text=Sign In')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('should show user menu with correct user information', async ({ page }) => {
    const auth = new AuthHelper(page)
    
    await auth.login('demo@example.com', 'demo')
    
    // Click user menu
    await page.click('[data-testid="user-menu-button"]')
    
    // Verify user information
    await expect(page.locator('text=Demo User')).toBeVisible()
    await expect(page.locator('text=demo@example.com')).toBeVisible()
    await expect(page.locator('text=Settings')).toBeVisible()
    await expect(page.locator('text=Sign Out')).toBeVisible()
  })

  test('should handle different user roles correctly', async ({ page }) => {
    const auth = new AuthHelper(page)
    
    // Test admin login
    await auth.loginAsAdmin()
    await expect(page.locator('text=Admin User')).toBeVisible()
    
    // Logout and test staff login
    await auth.logout()
    await auth.loginAsStaff()
    await expect(page.locator('text=Staff User')).toBeVisible()
  })

  test('should show loading state during login', async ({ page }) => {
    await page.goto('/nanopore')
    
    // Fill credentials
    await page.fill('input[type="email"]', 'demo@example.com')
    await page.fill('input[type="password"]', 'demo')
    
    // Click login button
    await page.click('button[type="submit"]')
    
    // Verify loading state
    await expect(page.locator('text=Signing in...')).toBeVisible()
  })
}) 