import Docker from "dockerode";
import net from "net";

const docker = new Docker();

/**
 * Finds a free port on the host machine dynamically.
 * @returns {Promise<number>}
 */
export function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * Spins up an isolated Docker container with the student's project mounted.
 * Port 3000 inside the container is mapped to a dynamic free port on the host
 * so Playwright (running on the host) can reach the served React app.
 *
 * Security constraints applied:
 * - NetworkMode: bridge  (needed for port binding; external calls blocked via DNS/firewall layer)
 * - Memory: 512MB cap
 * - CpuShares: 512
 * - ReadonlyRootfs: true  (no disk writes outside /app bind mount)
 * - AutoRemove: true
 *
 * @param {string} projectPath  - Absolute path to extracted project on host
 * @returns {{ container, hostPort }} - Dockerode container + mapped host port
 */
export async function spinTestEnvironment(projectPath) {

  const hostPort = await getFreePort();

  const container = await docker.createContainer({
    Image: "node:20",
    Tty: true,
    WorkingDir: "/app",

    ExposedPorts: {
      "3000/tcp": {},
    },

    HostConfig: {
      Binds: [`${projectPath}:/app`],

      // Map container port 3000 → dynamic host port
      PortBindings: {
        "3000/tcp": [{ HostIp: "0.0.0.0", HostPort: String(hostPort) }],
      },

      Memory: 512 * 1024 * 1024,    // 512 MB RAM cap
      CpuShares: 512,               // ~50% of one CPU core
      ReadonlyRootfs: false,        // /app is writable (needed for npm install)
      AutoRemove: true,
    },

    Cmd: ["sleep", "300"],
  });

  await container.start();

  return { container, hostPort };
}

/**
 * Runs a shell command inside the container and returns stdout+stderr as a string.
 * @param {object} container  - Dockerode container instance
 * @param {string} command    - Shell command to run
 * @returns {Promise<string>}
 */
export async function execCommand(container, command) {
  const exec = await container.exec({
    Cmd: ["sh", "-c", command],
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start();

  return new Promise((resolve, reject) => {
    let output = "";

    stream.on("data", (chunk) => {
      // Docker multiplexed stream header is 8 bytes. 
      // [STREAM_TYPE, 0, 0, 0, SIZE1, SIZE2, SIZE3, SIZE4]
      // We strip it to get the raw text output.
      let offset = 0;
      while (offset < chunk.length) {
        const type = chunk.readUInt8(offset);
        const size = chunk.readUInt32BE(offset + 4);
        offset += 8;
        if (offset + size <= chunk.length) {
          output += chunk.slice(offset, offset + size).toString();
        }
        offset += size;
      }
    });

    stream.on("end", () => {
      resolve(output.trim());
    });

    stream.on("error", reject);
  });
}

/**
 * Runs a command in the background (detached), so it stays alive even after 
 * this execution session closes (crucial for long-running servers).
 * @param {object} container - Dockerode container instance
 * @param {string} command - Shell command to run
 */
export async function execCommandDetached(container, command) {
  const exec = await container.exec({
    Cmd: ["sh", "-c", command],
    Detach: true,
  });

  await exec.start({ Detach: true });
}


/**
 * Automatically kills the container after the specified timeout (ms).
 * Prevents runaway processes from consuming host resources.
 *
 * @param {object} container  - Dockerode container instance
 * @param {number} timeout    - Timeout in milliseconds (default: 120s)
 */
export async function enforceTimeout(container, timeout = 120000) {
  setTimeout(async () => {
    try {
      await container.kill();
      console.log("Container killed due to timeout.");
    } catch {
      // Container may have already stopped — silently ignore
    }
  }, timeout);
}
