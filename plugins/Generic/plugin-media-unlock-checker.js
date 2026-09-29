/**
 * 本插件参考代码：https://github.com/clash-verge-rev/clash-verge-rev/tree/dev/crates/clash-verge-media-unlock
 * 上游同步基准：https://github.com/clash-verge-rev/clash-verge-rev/commit/2717aaadad38908c0a3b7e17ffb655910185c85c
 */

/* 触发器 手动触发 */
const onRun = async () => {
  const modal = Plugins.modal({
    title: Plugin.name,
    cancelText: 'common.close',
    submit: false
  })

  const content = {
    template: `
    <div class="flex items-center justify-between">
      <div class="font-bold text-16">
        {{ loading ? '正在检测：' + progress + '/' + length : done ? '检测结束，用时：' + duration : '共 ' + length + ' 个检测项目' }}
      </div>
      <Button @click="onClick" :loading="loading" :disabled="result.some(item => item.loading)" type="primary">
        {{ done ? '重新检测' : '开始检测' }}
      </Button>
    </div>
    <div class="grid grid-cols-4 gap-8 p-8">
      <Card v-for="(item, index) in result" :key="item.result.name" :title="item.result.name">
        <div class="flex items-center justify-between gap-8">
          <div>{{item.result.status}} {{item.result.region}}</div>
          <Button @click="checkOne(index)" :loading="item.loading" :disabled="loading" size="small">重测</Button>
        </div>
        <div class="text-12 text-right mt-4">{{item.duration}}</div>
      </Card>
    </div>
    `,
    setup() {
      const { ref } = Vue

      const list = Object.values(Checker).filter((v) => !v.skip)
      const length = list.length

      const createPendingRows = () => list.map((checker) => ({ result: new CheckResult(checker.name, 'Pending', '-'), duration: '-', loading: false }))
      const result = ref(createPendingRows())
      const loading = ref(false)
      const progress = ref(0)
      const done = ref(false)
      const duration = ref()

      const runItem = async (index) => {
        const checker = list[index]
        result.value[index].loading = true
        const startTime = Date.now()
        const checked = await checkWithTimeout(checker)
        checked.status = formatDisplayStatus(checked.status)
        checked.region = checked.region || '-'
        result.value[index] = { result: checked, duration: (Date.now() - startTime) / 1000 + 's', loading: false }
      }

      const check = async () => {
        result.value = createPendingRows()
        let nextIndex = 0
        const worker = async () => {
          while (nextIndex < length) {
            const index = nextIndex++
            await runItem(index)
            progress.value += 1
          }
        }

        const startTime = Date.now()
        await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_CHECKS, length) }, worker))
        duration.value = (Date.now() - startTime) / 1000 + 's'
      }

      return {
        loading,
        result,
        length,
        done,
        progress,
        duration,
        async checkOne(index) {
          await runItem(index)
        },
        async onClick() {
          done.value = false
          progress.value = 0
          loading.value = true
          await check()
          loading.value = false
          done.value = true
        }
      }
    }
  }

  modal.setContent(content)
  modal.open()
}

const ISO_ALPHA3_TO_ALPHA2 = Object.fromEntries(
  `
ABW:AW AFG:AF AGO:AO AIA:AI ALA:AX ALB:AL AND:AD ARE:AE ARG:AR ARM:AM ASM:AS ATA:AQ ATF:TF ATG:AG AUS:AU AUT:AT AZE:AZ
BDI:BI BEL:BE BEN:BJ BES:BQ BFA:BF BGD:BD BGR:BG BHR:BH BHS:BS BIH:BA BLM:BL BLR:BY BLZ:BZ BMU:BM BOL:BO BRA:BR BRB:BB BRN:BN BTN:BT BVT:BV BWA:BW
CAF:CF CAN:CA CCK:CC CHE:CH CHL:CL CHN:CN CIV:CI CMR:CM COD:CD COG:CG COK:CK COL:CO COM:KM CPV:CV CRI:CR CUB:CU CUW:CW CXR:CX CYM:KY CYP:CY CZE:CZ
DEU:DE DJI:DJ DMA:DM DNK:DK DOM:DO DZA:DZ ECU:EC EGY:EG ERI:ER ESH:EH ESP:ES EST:EE ETH:ET
FIN:FI FJI:FJ FLK:FK FRA:FR FRO:FO FSM:FM GAB:GA GBR:GB GEO:GE GGY:GG GHA:GH GIB:GI GIN:GN GLP:GP GMB:GM GNB:GW GNQ:GQ GRC:GR GRD:GD GRL:GL GTM:GT GUF:GF GUM:GU GUY:GY
HKG:HK HMD:HM HND:HN HRV:HR HTI:HT HUN:HU IDN:ID IMN:IM IND:IN IOT:IO IRL:IE IRN:IR IRQ:IQ ISL:IS ISR:IL ITA:IT
JAM:JM JEY:JE JOR:JO JPN:JP KAZ:KZ KEN:KE KGZ:KG KHM:KH KIR:KI KNA:KN KOR:KR KWT:KW LAO:LA LBN:LB LBR:LR LBY:LY LCA:LC LIE:LI LKA:LK LSO:LS LTU:LT LUX:LU LVA:LV
MAC:MO MAF:MF MAR:MA MCO:MC MDA:MD MDG:MG MDV:MV MEX:MX MHL:MH MKD:MK MLI:ML MLT:MT MMR:MM MNE:ME MNG:MN MNP:MP MOZ:MZ MRT:MR MSR:MS MTQ:MQ MUS:MU MWI:MW MYS:MY MYT:YT
NAM:NA NCL:NC NER:NE NFK:NF NGA:NG NIC:NI NIU:NU NLD:NL NOR:NO NPL:NP NRU:NR NZL:NZ OMN:OM PAK:PK PAN:PA PCN:PN PER:PE PHL:PH PLW:PW PNG:PG POL:PL PRI:PR PRK:KP PRT:PT PRY:PY PSE:PS PYF:PF
QAT:QA REU:RE ROU:RO RUS:RU RWA:RW SAU:SA SDN:SD SEN:SN SGP:SG SGS:GS SHN:SH SJM:SJ SLB:SB SLE:SL SLV:SV SMR:SM SOM:SO SPM:PM SRB:RS SSD:SS STP:ST SUR:SR SVK:SK SVN:SI SWE:SE SWZ:SZ SXM:SX SYC:SC SYR:SY
TCA:TC TCD:TD TGO:TG THA:TH TJK:TJ TKL:TK TKM:TM TLS:TL TON:TO TTO:TT TUN:TN TUR:TR TUV:TV TWN:TW TZA:TZ UGA:UG UKR:UA UMI:UM URY:UY USA:US UZB:UZ
VAT:VA VCT:VC VEN:VE VGB:VG VIR:VI VNM:VN VUT:VU WLF:WF WSM:WS XKK:XK YEM:YE ZAF:ZA ZMB:ZM ZWE:ZW
  `
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(':'))
)
const ISO_ALPHA2_CODES = new Set(Object.values(ISO_ALPHA3_TO_ALPHA2))

function countryCodeToEmoji(input) {
  if (typeof input !== 'string') return ''

  let code = input.trim().toUpperCase()
  if (code.length === 3) code = ISO_ALPHA3_TO_ALPHA2[code]
  if (!/^[A-Z]{2}$/.test(code) || !ISO_ALPHA2_CODES.has(code)) return ''

  const firstChar = code.charCodeAt(0) - 65 + 0x1f1e6
  const secondChar = code.charCodeAt(1) - 65 + 0x1f1e6

  return String.fromCodePoint(firstChar) + String.fromCodePoint(secondChar)
}

function formatDisplayRegion(region) {
  if (typeof region !== 'string') return region
  if (region.includes('Client.Timeout')) return '😤连接超时'
  if (/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(region)) return region

  const countryCode = region.match(/^([A-Za-z]{2,3})(?=$|[\s（(])/)?.[1]
  if (!countryCode) return region

  return countryCodeToEmoji(countryCode) + region
}

function toBodyText(body) {
  return typeof body === 'string' ? body : JSON.stringify(body)
}

function extractMatch(text, patterns, transform = (value) => value) {
  for (const pattern of patterns) {
    const matched = text.match(pattern)?.[1]
    if (matched) return transform(matched)
  }
  return null
}

function extractTraceRegion(body) {
  return (
    toBodyText(body)
      .match(/(?:^|\n)loc=([^\n]+)/)?.[1]
      ?.trim()
      ?.toUpperCase() || null
  )
}

function getHeaderValue(headers, key) {
  if (!headers || typeof headers !== 'object') return null

  const matchedKey = Object.keys(headers).find((headerKey) => headerKey.toLowerCase() === key.toLowerCase())
  const value = matchedKey ? headers[matchedKey] : null

  if (Array.isArray(value)) return value.join('; ')
  return typeof value === 'string' ? value : null
}

function isCloudflareChallenge(bodyText, headers) {
  const server = getHeaderValue(headers, 'server')?.toLowerCase() || ''
  return (
    bodyText.includes('__cf_chl_tk') ||
    bodyText.includes('challenge-platform') ||
    bodyText.includes('Enable JavaScript and cookies to continue') ||
    server.includes('cloudflare')
  )
}

function extractSpotifyRegion(bodyText, headers) {
  const bodyRegion = extractMatch(
    bodyText,
    [/"countryCode"\s*:\s*"([^"]+)"/, /"market"\s*:\s*\{\s*"id"\s*:\s*"([^"]+)"/, /"market":\{"id":"([^"]+)"/],
    (value) => value.split('-')[0].trim().toUpperCase()
  )
  if (bodyRegion) return bodyRegion

  const setCookie = getHeaderValue(headers, 'set-cookie') || ''
  const cookieRegion = extractMatch(
    setCookie,
    [/spotify\.com%2F([a-z]{2})%2Fapi/i, [/; ]sp_landing=https?:\/\/www\.spotify\.com\/([a-z]{2})\/api/i][0]],
    (value) => value.trim().toUpperCase()
  )

  return cookieRegion
}

function findDeepValue(value, key) {
  if (!value || typeof value !== 'object') return undefined
  if (Object.prototype.hasOwnProperty.call(value, key)) return value[key]

  for (const child of Object.values(value)) {
    const matched = findDeepValue(child, key)
    if (matched !== undefined) return matched
  }

  return undefined
}

async function isDisneyUnavailable() {
  try {
    const { headers } = await Plugins.HttpGet('https://disneyplus.com', undefined, { Redirect: false })
    const location = getHeaderValue(headers, 'location') || ''
    return location.includes('preview') || location.includes('unavailable')
  } catch {
    return true
  }
}

async function getDisneyFallbackResult(name) {
  try {
    const { body } = await Plugins.HttpGet('https://www.disneyplus.com/')
    const region = toBodyText(body).match(/region"\s*:\s*"([^"]+)"/)?.[1]
    if (region) return new CheckResult(name, 'Yes', `${region} (from main page)`)
  } catch {}

  return null
}

function formatDisplayStatus(status) {
  if (typeof status !== 'string') return status

  const normalized = status.trim()
  if (normalized.includes('Client.Timeout')) return '😤连接超时'
  if (normalized === 'Failed (Cloudflare Challenge)') return '⚠️验证拦截'
  if (normalized === 'Disallowed ISP') return '⚠️受限网络'
  if (normalized === 'Unsupported Country/Region') return '❌不支持地区'
  if (normalized === 'Originals Only') return '⚠️仅自制剧'
  if (normalized === 'Blocked') return '❌已封锁'
  if (normalized === 'Soon') return '⏳即将上线'
  if (normalized === 'Unknown') return '⚠️未知'

  return normalized.replace('Yes', '✅').replace('No', '❌')
}

class CheckResult {
  constructor(name, status, region) {
    this.name = name
    this.status = status
    this.region = formatDisplayRegion(region)
  }
}

const MAX_CONCURRENT_CHECKS = 4
const CHECK_TIMEOUT = 15 * 1000

async function checkWithTimeout(checker) {
  let timeoutId
  try {
    return await Promise.race([
      checker.check(),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(new CheckResult(checker.name, 'Failed', null)), CHECK_TIMEOUT)
      })
    ])
  } catch {
    return new CheckResult(checker.name, 'Failed', null)
  } finally {
    clearTimeout(timeoutId)
  }
}

const Checker = {
  bilibili: {
    skip: true,
    async check(name, url) {
      let status, region

      try {
        const { body } = await Plugins.HttpGet(url)
        if (body.code === 0) status = 'Yes'
        else if (body.code === -10403) status = 'No'
        else status = 'Failed'
      } catch {}

      return new CheckResult(name, status, region)
    }
  },
  bilibili_china_mainland: {
    name: '哔哩哔哩大陆',
    check() {
      return Checker.bilibili.check(
        this.name,
        'https://api.bilibili.com/pgc/player/web/playurl?avid=82846771&qn=0&type=&otype=json&ep_id=307247&fourk=1&fnver=0&fnval=16&module=bangumi'
      )
    }
  },
  bilibili_hk_mc_tw: {
    name: '哔哩哔哩港澳台',
    check() {
      return Checker.bilibili.check(
        this.name,
        'https://api.bilibili.com/pgc/player/web/playurl?avid=18281381&cid=29892777&qn=0&type=&otype=json&ep_id=183799&fourk=1&fnver=0&fnval=16&module=bangumi'
      )
    }
  },
  chatgpt_web: {
    name: 'ChatGPT Web',
    async check() {
      let status = 'Failed'
      let region

      const regionPromise = Plugins.HttpGet('https://chat.openai.com/cdn-cgi/trace')
        .then(({ body }) => extractTraceRegion(body))
        .catch(() => null)

      try {
        const { body } = await Plugins.HttpGet('https://api.openai.com/compliance/cookie_requirements')
        const bodyLower = toBodyText(body).toLowerCase()
        if (bodyLower.includes('unsupported_country')) status = 'Unsupported Country/Region'
        else status = 'Yes'
      } catch {}
      region = await regionPromise

      return new CheckResult(this.name, status, region)
    }
  },
  claude: {
    name: 'Claude',
    async check() {
      let status = 'Failed'
      let region

      try {
        const { body } = await Plugins.HttpGet('https://claude.ai/cdn-cgi/trace')
        region = extractTraceRegion(body)
        if (!region) {
          status = 'Failed'
        } else if (['AF', 'BY', 'CN', 'CU', 'HK', 'IR', 'KP', 'MO', 'RU', 'SY'].includes(region)) {
          status = 'No'
        } else {
          status = 'Yes'
        }
      } catch {}

      return new CheckResult(this.name, status, region)
    }
  },
  gemini: {
    name: 'Gemini',
    async check() {
      let status = 'Failed'
      let region

      try {
        const { body } = await Plugins.HttpGet('https://gemini.google.com')
        const bodyText = toBodyText(body)
        region = extractMatch(bodyText, [/,2,1,200,"([A-Z]{3})"/], (value) => value.toUpperCase())
        if (!region) status = 'Failed'
        else if (['CHN', 'RUS', 'BLR', 'CUB', 'IRN', 'PRK', 'SYR', 'HKG', 'MAC'].includes(region)) status = 'No'
        else status = 'Yes'
      } catch {}

      return new CheckResult(this.name, status, region)
    }
  },
  youtube_premium: {
    name: 'YouTube Premium',
    async check() {
      let status = 'Failed'
      let region

      try {
        const { body, status: statusCode } = await Plugins.HttpGet('https://www.youtube.com/premium?hl=en')
        const bodyText = toBodyText(body)
        const bodyLower = bodyText.toLowerCase()
        region = extractMatch(
          bodyText,
          [
            /id=["']country-code["'][^>]*>\s*([A-Za-z]{2,3})\s*</,
            /"GL"\s*:\s*"([A-Za-z]{2})"/,
            /"countryCode"\s*:\s*"([A-Za-z]{2})"/,
            /"country_code"\s*:\s*"([A-Za-z]{2})"/
          ],
          (value) => value.trim().toUpperCase()
        )
        if (
          bodyLower.includes('youtube premium is not available in your country') ||
          bodyLower.includes('premium is not available in your country') ||
          bodyLower.includes('premium is not available in your region')
        ) {
          status = 'No'
        } else if (
          statusCode >= 200 &&
          statusCode < 300 &&
          (bodyLower.includes('youtube premium') || bodyLower.includes('ad-free') || bodyLower.includes('"browseid":"spunlimited"'))
        ) {
          status = 'Yes'
        }
      } catch {}

      return new CheckResult(this.name, status, region)
    }
  },
  bahamut_anime: {
    name: 'Bahamut Anime',
    UserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    async check() {
      try {
        const { body, headers } = await Plugins.HttpGet('https://ani.gamer.com.tw/ajax/getdeviceid.php', {
          'User-Agent': this.UserAgent
        })
        const bodyText = toBodyText(body)
        if (isCloudflareChallenge(bodyText, headers)) {
          return new CheckResult(this.name, 'Failed (Cloudflare Challenge)', null)
        }
        const deviceId = bodyText.match(/"deviceid"\s*:\s*"([^"]+)/)?.[1]
        if (!deviceId) {
          return new CheckResult(this.name, 'Failed', null)
        }
        const { body: body2, headers: headers2 } = await Plugins.HttpGet('https://ani.gamer.com.tw/ajax/token.php?adID=89422&sn=37783&device=' + deviceId, {
          'User-Agent': this.UserAgent
        })
        const body2Text = toBodyText(body2)
        if (isCloudflareChallenge(body2Text, headers2)) {
          return new CheckResult(this.name, 'Failed (Cloudflare Challenge)', null)
        }
        if (!body2Text.includes('animeSn')) {
          return new CheckResult(this.name, 'No', null)
        }
        const { body: body3 } = await Plugins.HttpGet('https://ani.gamer.com.tw/', {
          'User-Agent': this.UserAgent
        })
        const body3Text = toBodyText(body3)
        const region = body3Text.match(/data-geo="([^"]+)/)?.[1]
        return new CheckResult(this.name, 'Yes', region)
      } catch {
        return new CheckResult(this.name, 'Failed', null)
      }
    }
  },
  netflix: {
    name: 'Netflix',
    async check() {
      const result = await Checker.netflix_cdn.check()
      if (result.status === 'Yes' || result.status.startsWith('No')) return result

      try {
        const [{ status: status1 }, { status: status2 }] = await Promise.all([
          Plugins.HttpGet('https://www.netflix.com/title/81280792'),
          Plugins.HttpGet('https://www.netflix.com/title/70143836')
        ])

        if (status1 === 404 && status2 === 404) {
          return new CheckResult(this.name, 'Originals Only', null)
        }
        if (status1 === 403 || status2 === 403) {
          return new CheckResult(this.name, 'No', null)
        }
        if (status1 === 200 || status1 === 301 || status2 === 200 || status2 === 301) {
          try {
            const { headers } = await Plugins.HttpGet('https://www.netflix.com/title/80018499', undefined, { Redirect: false })
            const location = headers['Location'] || headers['location']
            if (location) {
              const parts = location.split('/')
              if (parts.length >= 4) {
                return new CheckResult(this.name, 'Yes', parts[3].split('-')[0] || 'US')
              }
            }
            return new CheckResult(this.name, 'Yes', 'US')
          } catch (error) {
            return new CheckResult(this.name, 'Yes (但无法获取区域)', null)
          }
        }
        return new CheckResult(this.name, `Failed (状态码: ${status1}_${status2})`, null)
      } catch {
        return new CheckResult(this.name, 'Failed', null)
      }
    }
  },
  netflix_cdn: {
    skip: true,
    async check() {
      let status = 'Failed'
      let region

      try {
        const { status: statusCode, body } = await Plugins.HttpGet(
          'https://api.fast.com/netflix/speedtest/v2?https=true&token=YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm&urlCount=5'
        )
        if (statusCode === 403) {
          status = 'No (IP Banned By Netflix)'
        } else if (body.targets?.[0]?.location?.country) {
          status = 'Yes'
          region = body.targets[0].location.country
        } else if (body.targets) {
          status = 'Unknown'
        } else {
          status = 'Failed (解析错误)'
        }
      } catch {
        status = 'Failed (CDN API)'
      }

      return new CheckResult('Netflix', status, region)
    }
  },
  disney_plus: {
    name: 'Disney+',
    Token: 'Bearer ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84',
    async check() {
      try {
        const { body, status } = await Plugins.HttpPost(
          'https://disney.api.edge.bamgrid.com/devices',
          {
            Authorization: this.Token,
            'Content-Type': 'application/json; charset=UTF-8'
          },
          {
            deviceFamily: 'browser',
            applicationRuntime: 'chrome',
            deviceProfile: 'windows',
            attributes: {}
          }
        )
        if (status === 403) {
          return new CheckResult(this.name, 'No (IP Banned By Disney+)', null)
        }

        const bodyText = toBodyText(body)
        const assertion = body?.assertion || bodyText.match(/"assertion"\s*:\s*"([^"]+)"/)?.[1]
        if (!assertion) {
          return new CheckResult(this.name, 'Failed (Cannot extract assertion)', null)
        }

        const { body: body2, status: status2 } = await Plugins.HttpPost(
          'https://disney.api.edge.bamgrid.com/token',
          {
            Authorization: this.Token,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          {
            grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
            latitude: '0',
            longitude: '0',
            platform: 'browser',
            subject_token: assertion,
            subject_token_type: 'urn:bamtech:params:oauth:token-type:device'
          }
        )
        const body2Text = toBodyText(body2)
        if (status2 === 403 || body2Text.includes('forbidden-location') || body2Text.includes('403 ERROR')) {
          return new CheckResult(this.name, 'No (IP Banned By Disney+)', null)
        }

        const refreshToken = body2?.refresh_token || body2Text.match(/"refresh_token"\s*:\s*"([^"]+)"/)?.[1]
        if (!refreshToken) {
          return new CheckResult(this.name, `Failed (Cannot extract refresh token: ${status2})`, null)
        }

        const unavailable = await isDisneyUnavailable()

        const { body: body3, status: status3 } = await Plugins.HttpPost(
          'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql',
          {
            Authorization: this.Token,
            'Content-Type': 'application/json'
          },
          {
            query: `mutation refreshToken($input: RefreshTokenInput!) {
              refreshToken(refreshToken: $input) {
                activeSession {
                  sessionId
                }
              }
            }`,
            variables: {
              input: {
                refreshToken
              }
            }
          }
        )

        const body3Text = toBodyText(body3)
        if (!body3Text || status3 < 200 || status3 >= 300) {
          return (await getDisneyFallbackResult(this.name)) || new CheckResult(this.name, `Failed (GraphQL: ${status3})`, null)
        }

        let graphData = body3
        if (!graphData || typeof graphData !== 'object') {
          try {
            graphData = JSON.parse(body3Text)
          } catch {
            return (await getDisneyFallbackResult(this.name)) || new CheckResult(this.name, 'Failed (Invalid GraphQL Response)', null)
          }
        }

        const region = findDeepValue(graphData, 'countryCode')
        const supported = findDeepValue(graphData, 'inSupportedLocation')

        if (!region) {
          return (await getDisneyFallbackResult(this.name)) || new CheckResult(this.name, 'No', null)
        }

        if (region === 'JP') {
          return new CheckResult(this.name, 'Yes', region)
        }

        if (unavailable) {
          return new CheckResult(this.name, 'No', null)
        }

        if (supported === false) {
          return new CheckResult(this.name, 'Soon', `${region}（即将上线）`)
        }
        if (supported === true) {
          return new CheckResult(this.name, 'Yes', region)
        }

        return new CheckResult(this.name, `Failed (Unknown region status for ${region})`, null)
      } catch {
        return new CheckResult(this.name, 'Failed (Network Connection)', null)
      }
    }
  },
  prime_video: {
    name: 'Prime Video',
    async check() {
      let status = 'Failed'
      let region

      try {
        const { body } = await Plugins.HttpGet('https://www.primevideo.com')
        const bodyText = toBodyText(body)
        region = bodyText.match(/"currentTerritory":"([^"]+)"/)?.[1]
        if (bodyText.includes('isServiceRestricted')) {
          status = 'No (Service Not Available)'
        } else if (region) {
          status = 'Yes'
        } else {
          status = 'Failed (PAGE ERROR)'
        }
      } catch {
        status = 'Failed (Network Connection)'
      }

      return new CheckResult(this.name, status, region)
    }
  },
  spotify: {
    name: 'Spotify',
    async check() {
      let status = 'Failed'
      let region

      try {
        const { body, status: statusCode, headers } = await Plugins.HttpGet('https://www.spotify.com/api/content/v1/country-selector?platform=web&format=json')
        const bodyText = toBodyText(body)
        region = body?.countryCode || extractSpotifyRegion(bodyText, headers)
        if (region) region = region.toUpperCase()

        if (statusCode === 403 || statusCode === 451) {
          status = 'No'
        } else if (statusCode < 200 || statusCode >= 300) {
          status = 'Failed'
        } else if (bodyText.toLowerCase().includes('not available in your country')) {
          status = 'No'
        } else {
          status = 'Yes'
        }
      } catch {}

      return new CheckResult(this.name, status, region)
    }
  },
  tiktok: {
    name: 'TikTok',
    async check() {
      let status = 'Failed'
      let region

      try {
        const { body, status: statusCode } = await Plugins.HttpGet('https://www.tiktok.com/cdn-cgi/trace')
        const bodyText = toBodyText(body)
        region = extractTraceRegion(body)
        if (statusCode === 403 || statusCode === 451) status = 'No'
        else if (statusCode < 200 || statusCode >= 300) status = 'Failed'
        else if (
          bodyText.toLowerCase().includes('access denied') ||
          bodyText.toLowerCase().includes('not available in your region') ||
          bodyText.toLowerCase().includes('tiktok is not available')
        )
          status = 'No'
        else status = 'Yes'
      } catch {}

      if (!region || status === 'Failed') {
        try {
          const { body, status: statusCode } = await Plugins.HttpGet('https://www.tiktok.com/')
          const bodyText = toBodyText(body)
          const fallbackRegion = bodyText
            .match(/"region"\s*:\s*"([a-zA-Z-]+)"/)?.[1]
            ?.split('-')?.[0]
            ?.toUpperCase()
          if (!region) region = fallbackRegion
          if (status !== 'No') {
            if (statusCode === 403 || statusCode === 451) status = 'No'
            else if (statusCode < 200 || statusCode >= 300) status = 'Failed'
            else if (
              bodyText.toLowerCase().includes('access denied') ||
              bodyText.toLowerCase().includes('not available in your region') ||
              bodyText.toLowerCase().includes('tiktok is not available')
            )
              status = 'No'
            else status = 'Yes'
          }
        } catch {}
      }

      return new CheckResult(this.name, status, region)
    }
  }
}
