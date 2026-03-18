import fp from "fastify-plugin"
import evaluateRoute from "../routes/evaluateRoute.js"

async function evaluateModule(fastify, options) {
    
    fastify.register(evaluateRoute, {prefix: "/evaluate"})

}

export default fp(evaluateModule)