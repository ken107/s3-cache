import { S3Cache } from "./index"
import * as assert from "assert"

assert(process.env.AWS_PROFILE)
assert(process.env.AWS_REGION)
assert(process.env.CACHE_BUCKET)
assert(process.env.CACHE_PREFIX)

const bucket = process.env.CACHE_BUCKET
const prefix = process.env.CACHE_PREFIX


const accessLog = {
  map: new Map<string, number>(),
  getLastAccessed(objKey: string) {
    return this.map.get(objKey) ?? 0
  },
  setLastAccessed(objKey: string) {
    this.map.set(objKey, Date.now())
  },
  delete(objKeys: string[]) {
    for (const objKey of objKeys) this.map.delete(objKey)
  }
}

const cache = new S3Cache({
  clientConfig: {},
  bucket,
  prefix,
  cleanupOpts: {
    accessLog,
    ttl: 1000,
    cleanupInterval: 1500,
  }
})

runTest()
  .catch(console.error)



async function runTest() {
  await Promise.all([
    cache.invalidate("1"),
    cache.invalidate("2"),
    cache.invalidate("3"),
  ])

  await sleep(3000)
  assert(await cache.get("1") === undefined)

  await cache.set("1", {data: Buffer.from("Uno"), metadata: {k: "one"}})
  //first cleanup triggered
  await cache.set("2", {data: Buffer.from("Dos")})

  const one = await cache.get("1")
  assert(one?.data.toString() == "Uno" && one.metadata?.k == "one")

  await sleep(1300)
  await cache.get("2")

  await sleep(300)
  await cache.set("3", {data: Buffer.from("Tres")})
  //second cleanup triggered 1600ms later, 1 has expired, 2 still valid

  await sleep(3000)
  assert(await cache.get("1") === undefined)
  assert((await cache.get("2"))?.data.toString() === "Dos")
  assert((await cache.get("3"))?.data.toString() === "Tres")

  assert(!accessLog.map.has(prefix + "1"))
  assert(accessLog.map.has(prefix + "2"))
  assert(accessLog.map.has(prefix + "3"))
}



function sleep(millis: number) {
  return new Promise(f => setTimeout(f, millis))
}
