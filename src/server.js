import "dotenv/config";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import evaluatorModule from "./modules/evaluateModule.js"

const fastify = Fastify({
    logger: true
})

fastify.register(multipart, {
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    }
})

fastify.register(evaluatorModule)


const start = async () => {
    try {
        const port = process.env.PORT || 4000;
        await fastify.listen({port})
        console.log(`Evaluator server running on port ${port}`)
    }catch(err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()