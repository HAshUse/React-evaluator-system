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
        await fastify.listen({port: 4000})
        console.log("Evaluator server running on port 4000")
    }catch(err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()