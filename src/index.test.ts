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
  async getLastAccessed(objKeys: string[]) {
    return objKeys.map(objKey => this.map.get(objKey) ?? 0)
  },
  async setLastAccessed(objKey: string) {
    this.map.set(objKey, Date.now())
  },
  async delete(objKeys: string[]) {
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
    cache.invalidate("4"),
    cache.invalidate("5"),
  ])

  //---------------------
  await sleep(3000)
  assert(await cache.get("1") === undefined)

  //1: set now and get now, will expire
  await cache.set("1", {data: Buffer.from("Uno"), metadata: {k: "one"}})
  //first cleanup triggered
  const one = await cache.get("1")
  assert(one?.data.toString() == "Uno" && one.metadata?.k == "one")

  //2: set now but get later, won't expire
  await cache.set("2", {data: Buffer.from("Dos")})

  //3: set now but never get, will expire
  await cache.set("3", {data: Buffer.from("Tres")})

  //---------------------
  await sleep(1300)
  await cache.get("2")

  //4: set late and never get, won't expire
  await cache.set("4", {data: Buffer.from("Quatro")})

  await sleep(300)
  await cache.set("5", {data: Buffer.from("Cinco")})
  //second cleanup triggered (1600ms after first)

  //----------------------
  await sleep(3000)
  assert(!accessLog.map.has(prefix + "1"))
  assert(accessLog.map.has(prefix + "2"))
  assert(!accessLog.map.has(prefix + "3"))
  assert(!accessLog.map.has(prefix + "4"))
  assert(!accessLog.map.has(prefix + "5"))

  assert(await cache.get("1") === undefined)
  assert((await cache.get("2"))?.data.toString() === "Dos")
  assert(await cache.get("3") === undefined)
  assert((await cache.get("4"))?.data.toString() === "Quatro")
  assert((await cache.get("5"))?.data.toString() === "Cinco")
}



function sleep(millis: number) {
  return new Promise(f => setTimeout(f, millis))
}
