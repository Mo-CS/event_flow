import { describe, it, expect } from "vitest"
import { login, register } from "../authService"

describe("authService", () => {
  it("login with valid email returns user, profile, and role", async () => {
    const result = await login("admin@eventflow.com", "password123")
    expect(result.user.email).toBe("admin@eventflow.com")
    expect(result.profile.firstName).toBe("Alice")
    expect(result.role).toBe("admin")
  })

  it("login with invalid email throws error", async () => {
    await expect(login("nonexistent@test.com", "any")).rejects.toThrow("Invalid email or password")
  })

  it("register creates new user with attendee role", async () => {
    const email = `newuser-${Date.now()}@test.com`
    const result = await register(email, "pass", "Test", "User")
    expect(result.user.email).toBe(email)
    expect(result.role).toBe("attendee")
    expect(result.profile.firstName).toBe("Test")
    expect(result.profile.lastName).toBe("User")
  })

  it("register with duplicate email throws error", async () => {
    await expect(register("admin@eventflow.com", "pass", "Dup", "User")).rejects.toThrow("Email already in use")
  })
})
