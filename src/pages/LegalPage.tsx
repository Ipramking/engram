import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Nav, Footer } from '../components/Chrome'

// Operator details shown in both documents. Fill CONTACT_EMAIL before launch.
const OPERATOR = 'Engram'
const SITE = 'engram-pearl.vercel.app'
const CONTACT_EMAIL = ''
const GOVERNING_LAW = 'the laws of the Federal Republic of Nigeria'
const EFFECTIVE = '5 November 2026'

const contact = CONTACT_EMAIL ? (
  <a className="text-rose underline-offset-2 hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
    {CONTACT_EMAIL}
  </a>
) : (
  <a className="text-rose underline-offset-2 hover:underline" href="https://github.com/Ipramking/engram/issues" target="_blank" rel="noreferrer">
    our GitHub issues page
  </a>
)

type Section = { h: string; body: ReactNode }

const PRIVACY: Section[] = [
  {
    h: 'Who we are',
    body: (
      <p>
        {OPERATOR} (“we”, “us”) runs a memory service for AI assistants at {SITE}, its API, its MCP endpoint and the
        engram-walrus command-line tool. This policy explains what personal data we handle, why, and the choices you have.
        Questions: {contact}.
      </p>
    ),
  },
  {
    h: 'What we collect',
    body: (
      <ul>
        <li><b>Account:</b> your email address and name. Passwords are handled by our authentication provider and stored only in hashed form.</li>
        <li><b>Memories:</b> the text you, or AI apps you connect, choose to save; its type (decision, config, gotcha, person, preference, plan); whether it is personal or shared with a team; and when it was saved.</li>
        <li><b>Keys and connections:</b> key names, a fingerprint of each key (never the key itself), what each key may do, and when it was created and last used; the names and return addresses of apps you connect with “Sign in with Engram”; the device name when you sign in from a terminal; and your Telegram chat ID if you link our bot.</li>
        <li><b>Usage:</b> daily counts of saves and recalls, used to apply plan limits.</li>
        <li><b>Technical data:</b> IP address, browser or app details and request logs, kept by our hosting provider for security and troubleshooting.</li>
        <li><b>On your device:</b> your sign-in session, preferences and any memories waiting to sync while you are offline, stored in your browser's local storage.</li>
      </ul>
    ),
  },
  {
    h: 'How we use it',
    body: (
      <>
        <ul>
          <li>To provide the service: store your memories, search them, and return them to the apps you connect.</li>
          <li>To keep it secure: authenticate requests, apply rate limits and quotas, and detect abuse.</li>
          <li>To support you and keep the service reliable.</li>
        </ul>
        <p>
          We do not sell your data, show ads, or use your memories to train AI models. Our legal bases are performing our
          agreement with you, our legitimate interest in running a secure service, and your consent where we ask for it.
        </p>
      </>
    ),
  },
  {
    h: 'AI apps you connect',
    body: (
      <p>
        When you connect an app such as Claude, ChatGPT, Cursor or Gemini, that app receives the memories it recalls and sends
        us the ones it saves. What that app does with the information is governed by its own privacy policy. You can disconnect
        any app at any time by revoking its key on the Keys page.
      </p>
    ),
  },
  {
    h: 'Service providers',
    body: (
      <>
        <p>We share data only with providers that help us run the service, and only as much as they need:</p>
        <ul>
          <li><b>Supabase</b>: database and sign-in.</li>
          <li><b>Vercel</b>: hosting and request logs.</li>
          <li><b>Walrus, via the MemWal service</b>: decentralised storage for some memories.</li>
          <li><b>Groq</b>: only for the built-in chat feature, which sends your message and relevant memories to generate a reply.</li>
          <li><b>GitHub</b>: encrypted database backups and our code repository.</li>
          <li><b>Telegram</b>: only if you link the Engram bot.</li>
        </ul>
        <p>We may also disclose data when the law requires it, to protect people's safety or our rights, or as part of a merger or acquisition, in which case this policy continues to apply.</p>
      </>
    ),
  },
  {
    h: 'Decentralised storage',
    body: (
      <p>
        Some memories are also written to Walrus, a decentralised storage network. Deleting a memory removes it from Engram's
        database and from recall straight away, but a copy may remain on Walrus until its storage period ends. Please don't save
        passwords, keys or sensitive personal information; save where they live instead.
      </p>
    ),
  },
  {
    h: 'How long we keep data',
    body: (
      <p>
        We keep your data while your account exists. Deleted memories leave our database immediately. Encrypted backups roll
        over within 30 days. Expired sign-in codes are cleared automatically. Logs are kept according to our providers' retention
        settings.
      </p>
    ),
  },
  {
    h: 'Security',
    body: (
      <p>
        Data is encrypted in transit, keys are stored only as fingerprints, every key can be limited and revoked, and access to
        team memory is checked on every request. No system is perfectly secure; if we learn of a breach affecting you, we will
        tell you without undue delay.
      </p>
    ),
  },
  {
    h: 'Your rights',
    body: (
      <>
        <p>Depending on where you live (including under Nigeria's Data Protection Act and the GDPR), you can:</p>
        <ul>
          <li>access and export your memories (Memories → Export);</li>
          <li>correct or delete individual memories;</li>
          <li>delete your account and its data (Dashboard → Usage → Delete account);</li>
          <li>object to or ask us to restrict processing, and withdraw consent;</li>
          <li>complain to a data protection authority, such as the Nigeria Data Protection Commission.</li>
        </ul>
        <p>For anything you can't do in the dashboard, contact us at {contact}.</p>
      </>
    ),
  },
  {
    h: 'International transfers',
    body: <p>Our providers may process data in other countries. We rely on the safeguards they provide, such as standard contractual clauses, for these transfers.</p>,
  },
  {
    h: 'Children',
    body: <p>Engram is not meant for children under 13, or under the minimum age required where you live. We don't knowingly collect their data; if you think we have, contact us and we will delete it.</p>,
  },
  {
    h: 'Changes',
    body: <p>We will update the date at the top when this policy changes, and tell you in the dashboard or by email before material changes take effect.</p>,
  },
]

const TERMS: Section[] = [
  {
    h: 'Agreement',
    body: (
      <p>
        These terms govern your use of {OPERATOR} at {SITE}, its API, MCP endpoint and command-line tool (the “Service”). By
        creating an account or using the Service you agree to them. If you use Engram for an organisation, you confirm you can
        accept these terms on its behalf.
      </p>
    ),
  },
  {
    h: 'The Service',
    body: <p>Engram stores memories and makes them available to AI apps you connect. It is in active development: features, limits and plans may change, and we will tell you about significant changes.</p>,
  },
  {
    h: 'Your account and keys',
    body: (
      <ul>
        <li>Give accurate account information and keep your password and keys secret.</li>
        <li>You are responsible for activity under your account and keys. If a key may be exposed, revoke it on the Keys page.</li>
        <li>You must be at least 13, or the minimum age where you live.</li>
      </ul>
    ),
  },
  {
    h: 'Your content',
    body: (
      <p>
        You keep ownership of the memories you save. You give us a licence to store, process, copy and transmit them only to run
        and secure the Service for you. You confirm you have the right to save what you save, and that it doesn't break the law
        or anyone's rights.
      </p>
    ),
  },
  {
    h: 'Acceptable use',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>use the Service for anything illegal, or to store other people's passwords, keys or personal data without permission;</li>
          <li>upload malware, or try to access accounts, keys or data that aren't yours;</li>
          <li>overload, scrape or disrupt the Service, or get around its limits or security;</li>
          <li>resell the Service or use it to build a competing product without our written permission.</li>
        </ul>
      </>
    ),
  },
  {
    h: 'Other services',
    body: <p>AI apps and services you connect to Engram are provided by others under their own terms. We aren't responsible for them, or for what they do with the memories they recall.</p>,
  },
  {
    h: 'Fees',
    body: <p>The current plans are free. If we introduce paid plans, we will explain the price and terms before you are charged anything.</p>,
  },
  {
    h: 'Availability and suspension',
    body: <p>We aim to keep Engram running but don't guarantee it will always be available or error-free. We may suspend access to protect the Service, other users or the law, and will tell you why when we can.</p>,
  },
  {
    h: 'Ending your use',
    body: <p>You can stop using Engram and delete your account at any time from the dashboard. We may end or suspend accounts that seriously or repeatedly break these terms. Sections that by their nature should survive (such as liability limits) continue to apply.</p>,
  },
  {
    h: 'Disclaimers',
    body: <p>The Service is provided “as is” and “as available”. To the extent the law allows, we make no warranties, express or implied, including fitness for a particular purpose and non-infringement. AI apps can misread memories; check important answers yourself.</p>,
  },
  {
    h: 'Limitation of liability',
    body: <p>To the extent the law allows, we are not liable for indirect, incidental, special or consequential damages, or for lost profits or data. Our total liability for any claim is limited to the greater of what you paid us in the 12 months before the claim and US$50. Nothing here limits liability that can't be limited by law.</p>,
  },
  {
    h: 'Indemnity',
    body: <p>You agree to cover reasonable costs and losses we suffer because of content you save or your breach of these terms, to the extent the law allows.</p>,
  },
  {
    h: 'Law and disputes',
    body: <p>These terms are governed by {GOVERNING_LAW}. We will first try to resolve any dispute informally; contact us at {contact}. Mandatory consumer protections where you live still apply.</p>,
  },
  {
    h: 'Changes',
    body: <p>We may update these terms. We will change the date at the top and give notice before material changes take effect. Continuing to use Engram after that means you accept the new terms.</p>,
  },
]

export default function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const isPrivacy = doc === 'privacy'
  const sections = isPrivacy ? PRIVACY : TERMS
  useEffect(() => {
    document.title = `${isPrivacy ? 'Privacy Policy' : 'Terms of Service'} · Engram`
    window.scrollTo(0, 0)
  }, [isPrivacy])

  return (
    <div className="min-h-dvh bg-bg text-txt">
      <Nav />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-12 sm:pt-16">
        <p className="eyebrow">Legal</p>
        <h1 className="mt-2 font-display text-[38px] leading-tight sm:text-[48px]">{isPrivacy ? 'Privacy Policy' : 'Terms of Service'}</h1>
        <p className="mt-3 text-[14px] text-faint">Effective {EFFECTIVE}</p>
        <p className="mt-6 text-[14px] text-mut">
          See also the {isPrivacy ? <Link className="text-rose hover:underline" to="/terms">Terms of Service</Link> : <Link className="text-rose hover:underline" to="/privacy">Privacy Policy</Link>}.
        </p>
        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.h}>
              <h2 className="font-display text-[22px] text-txt">
                {i + 1}. {s.h}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-mut [&_b]:font-medium [&_b]:text-txt [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
