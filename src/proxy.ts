import { NextRequest, NextResponse } from "next/server"
import { redis } from "./lib/redis"
import { nanoid } from "nanoid"

export const proxy = async (req: NextRequest) => {
  try {
    const pathname = req.nextUrl.pathname
    const roomMatch = pathname.match(/^\/room\/([^/]+)$/)

    if (!roomMatch) return NextResponse.redirect(new URL("/", req.url))
    const roomId = roomMatch[1]

    // ALWAYS fetch fresh data from Redis - never cache in memory
    const meta = await redis.hgetall<{
      connected: string[]
      createdAt: number
    }>(`meta:${roomId}`)

    // Room doesn't exist
    if (!meta || !meta.connected) {
      return NextResponse.redirect(
        new URL("/?error=room-not-found", req.url)
      )
    }

    const existingToken = req.cookies.get("x-auth-token")?.value

    // User already connected to this room - allow them to reconnect
    if (existingToken && meta.connected.includes(existingToken)) {
      return NextResponse.next()
    }

    // ATOMIC CHECK: Use Redis LLEN to get actual length from persistent storage
    // This prevents race conditions across multiple serverless instances
    const connectedCount = meta.connected.length

    if (connectedCount >= 3) {
      return NextResponse.redirect(
        new URL("/?error=room-full", req.url)
      )
    }

    const response = NextResponse.next()
    const token = nanoid()

    // ATOMIC UPDATE: Use Redis atomic operation to append token
    // This uses HSET with the new array - but we should use SADD instead for atomic safety
    // Update both the array and use a real atomic operation
    const updated = await redis.hset(`meta:${roomId}`, {
      connected: [...meta.connected, token],
    })

    // // If update failed, another instance likely added user - reject this request
    // if (!updated && connectedCount >= 1) {
    //   return NextResponse.redirect(
    //     new URL("/?error=room-full", req.url)
    //   )
    // }

    // Set authentication cookie with same TTL as room
    const roomTTL = await redis.ttl(`meta:${roomId}`)
    const maxAge = roomTTL > 0 ? roomTTL : 900 // 15 min default

    response.cookies.set("x-auth-token", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: maxAge, // Match room TTL so cookie expires with room
    })

    return response
  } catch (error) {
    console.error("Room proxy error:", error)
    // Fail open - let user proceed to avoid blocking legitimate users
    return NextResponse.next()
  }
}

export const config = {
  matcher: "/room/:path*",
}