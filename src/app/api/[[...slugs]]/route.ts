
import { redis } from "@/src/lib/redis"
import { Elysia, t } from "elysia"
import { nanoid } from "nanoid"
import { autheMiddleware } from "./auth"
import { z } from "zod"
import { Message, realtime } from "@/src/lib/realtime"


const ROOM_TTL_SECONDS=60*15

// CORS Middleware for cross-origin requests from different devices
const corsMiddleware = (app: Elysia) => {
  return app.onRequest(({ request, set }) => {
    const origin = request.headers.get("origin") || "*"
    
    // Allow requests from any origin for mobile/cross-device support
    set.headers["Access-Control-Allow-Origin"] = origin
    set.headers["Access-Control-Allow-Credentials"] = "true"
    set.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
    set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Cookie, x-auth-token"
    set.headers["Access-Control-Max-Age"] = "86400"
    
    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 })
    }
  })
}

const rooms = new Elysia({prefix:"/room"}).
post("/create", async()=>{
    const roomId=nanoid()

    await redis.hset(`meta:${roomId}`,{
        connected:[],
        createdAt: Date.now(),
    })

    await redis.expire(`meta:${roomId}`, ROOM_TTL_SECONDS)

    return {roomId}

}).use(autheMiddleware)
.get("/ttl", async ({auth})=>{
    const ttl=await redis.ttl(`meta:${auth.roomId }`)

    return {ttl: ttl>0 ? ttl : 0}
}, {
    
    query: z.object({ roomId :z.string()})
})
.delete("/", async({auth})=>{

    await realtime.channel(auth.roomId).emit("chat.destroy",{
        isDestroyed:true,
    })

    await Promise.all([
        redis.del(auth.roomId),
        redis.del(`meta:${auth.roomId}`),
        redis.del(`messages:${auth.roomId}`),
    ])
  
},{query : z.object({ roomId :z.string()

})
})

const messages =new Elysia({ prefix: "/messages"}).use(autheMiddleware)
.post("/", async ({body,auth})=>{
    const{ sender,text}=body

    const {roomId}=auth

    const roomExist=await redis.exists(`meta:${roomId}`)

    if(!roomExist){
        throw new Error("Room does not exist")
    }

    const message: Message={
        id:nanoid(),
        sender,
        text,
        timestamp: Date.now(),
        roomId,
    }

    //addd msg to history
    await redis.rpush(`messages:${roomId}`,
        {...message, token: auth.token})

        await realtime.channel(roomId).emit("chat.message",message)

        //housekeeping

        const remaining=await redis.ttl(`meta:${roomId}`)

        await redis.expire(`messages:${roomId}`,remaining )
        await redis.expire(`history:${roomId}`,remaining)
        await redis.expire(roomId,remaining)

},{
    query:z.object({roomId : z.string()}),
    body: z.object({
        sender: z.string().max(100),
        text:z.string().max(1000),
    }),
})
.get("/",
    async ({auth})=>{
        const messages=await redis.lrange
        <Message>(`messages:${auth.roomId}`,0, -1)

        return {
            messages:messages.map((m)=>({
            ...m,
            token: m.token ===auth.token ?
            auth.token: undefined,
            })),
        }
    },
    {query : z.object({ roomId: z.string()})}
)

const app = new Elysia({ prefix: "/api" }).use(corsMiddleware).use(rooms).use(messages)

export const GET = app.fetch
export const POST = app.fetch
export const DELETE = app.fetch
export const OPTIONS = app.fetch

export type App = typeof app
