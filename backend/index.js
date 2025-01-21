const { Elysia } = require('elysia')
const { cors } = require('@elysiajs/cors')
const Redis = require('ioredis')
const { PrismaClient } = require('@prisma/client')
const { hash } = require('bcryptjs')

const prisma = new PrismaClient()
const redis = new Redis(process.env.REDIS_URL)

const app = new Elysia()
    .use(cors())
    .derive(({ request }) => ({
        rateLimit: async () => {
            const ip = request.headers.get('x-forwarded-for') || 'unknown'
            const key = `rate-limit:${ip}`
            const limit = 100 // requests
            const window = 60 * 60 // 1 hour in seconds

            const current = await redis.incr(key)
            if (current === 1) {
                await redis.expire(key, window)
            }

            if (current > limit) {
                throw new Error('Too many requests')
            }
        }
    }))
    .post('/register', async ({ body, rateLimit }) => {
        await rateLimit()

        const { username, email, password } = body

        // Check cache first
        const cachedUser = await redis.get(`user:${email}`)
        if (cachedUser) {
            return {
                status: 400,
                body: { message: 'Email already exists' }
            }
        }

        // Check database
        const existingUser = await prisma.user.findUnique({
            where: { email }
        })

        if (existingUser) {
            // Cache the result
            await redis.set(`user:${email}`, JSON.stringify(existingUser), 'EX', 3600)
            return {
                status: 400,
                body: { message: 'Email already exists' }
            }
        }

        // Hash password
        const hashedPassword = await hash(password, 10)

        // Create new user
        const user = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword
            }
        })

        // Cache the new user
        await redis.set(`user:${email}`, JSON.stringify(user), 'EX', 3600)

        return {
            id: user.id,
            username: user.username,
            email: user.email
        }
    })
    .get('/', () => 'Hello from Luckybox API!')
    .listen(4000)

console.log('🚀 Server is running on http://localhost:4000') 