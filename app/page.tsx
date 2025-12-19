import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 overflow-x-hidden">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-slate-950 to-slate-950" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] mix-blend-screen animate-[pulse_8s_ease-in-out_infinite]" />
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] mix-blend-screen animate-[pulse_8s_ease-in-out_infinite_4s]" />
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center z-10">
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 leading-tight">
              <span className="block text-white">Predict Prices</span>
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                With Total Privacy
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              A decentralized price prediction platform leveraging Zama&apos;s Fully Homomorphic Encryption (FHE). 
              Experience true on-chain privacy where your predictions remain encrypted throughout the entire process.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Link
                href="/predict"
                className="group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl overflow-hidden transition-all duration-300 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02]"
              >
                <span className="relative flex items-center gap-2">
                  Start Predicting
                  <svg
                    className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </span>
              </Link>

              <a
                href="https://docs.zama.org/protocol"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-slate-900/50 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white font-semibold rounded-xl transition-all duration-300 backdrop-blur-sm"
              >
                Learn Technology
              </a>
            </div>
          </div>
        </section>

        {/* Timeline Section */}
        <section className="py-32 bg-gradient-to-b from-transparent to-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-center mb-20 text-white">Game Timeline</h2>

            <div className="relative">
              {/* Connection Line */}
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-px bg-slate-800 -translate-y-1/2" />
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
                {[
                  {
                    step: "01",
                    title: "Prediction Phase",
                    desc: "Submit your encrypted prediction and stake ETH.",
                    duration: "0-48h",
                    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                  },
                  {
                    step: "02",
                    title: "Locked Phase",
                    desc: "Predictions are sealed. No changes allowed.",
                    duration: "48-72h",
                    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
                  },
                  {
                    step: "03",
                    title: "Settlement",
                    desc: "Real price revealed and winners calculated on-chain.",
                    duration: "72h+",
                    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
                  },
                  {
                    step: "04",
                    title: "Claiming",
                    desc: "Winners can claim their share of rewards within 7 days.",
                    duration: "7 days",
                    icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
                  },
                ].map((item, i) => (
                  <div key={i} className="relative group">
                    <div className="w-16 h-16 mx-auto bg-slate-900 rounded-2xl flex items-center justify-center mb-8 border border-slate-800 shadow-lg group-hover:border-indigo-500/50 group-hover:shadow-indigo-500/20 transition-all duration-500 z-10 relative">
                      <svg className="w-6 h-6 text-slate-400 group-hover:text-indigo-400 transition-colors duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center border border-slate-950">
                        <span className="text-xs font-bold text-slate-400">{item.step}</span>
                      </div>
                    </div>
                    <div className="text-center p-6 rounded-2xl bg-slate-900/30 border border-slate-800/50 hover:border-indigo-500/20 hover:bg-slate-900/50 transition-all duration-300">
                      <h3 className="text-lg font-bold mb-2 text-slate-200 group-hover:text-white transition-colors">{item.title}</h3>
                      <div className="inline-block px-2 py-0.5 rounded text-[10px] font-mono text-indigo-400 bg-indigo-500/10 mb-4 border border-indigo-500/20">
                        {item.duration}
                      </div>
                      <p className="text-slate-400 text-sm leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-32 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                Why Choose <span className="text-indigo-400">Only Up</span>?
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Built on cutting-edge cryptography to ensure fairness and privacy for every participant.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Feature 1 - Large */}
              <div className="md:col-span-2 glass-panel rounded-3xl p-10 hover:border-indigo-500/30 hover:bg-slate-900/80 transition-all duration-500 group">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <svg
                    className="w-6 h-6 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">
                  FHE-Powered Confidentiality
                </h3>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Predictions are encrypted locally using Fully Homomorphic Encryption (FHE) before submission. 
                  Your strategy remains confidential until settlement through a secure three-step decryption process, 
                  protecting against front-running and copy-trading.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="glass-panel rounded-3xl p-10 hover:border-indigo-500/30 hover:bg-slate-900/80 transition-all duration-500 group">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <svg
                    className="w-6 h-6 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-4 text-white">
                  Claim Your Rewards
                </h3>
                <p className="text-slate-400">
                  Winners can claim their proportional share of the prize pool within 7 days after settlement. Rewards are distributed based on stake ratio.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="glass-panel rounded-3xl p-10 hover:border-indigo-500/30 hover:bg-slate-900/80 transition-all duration-500 group">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <svg
                    className="w-6 h-6 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-bold mb-4 text-white">
                  Provably Fair
                </h3>
                <p className="text-slate-400">
                  All logic is executed on-chain. The source code is verified and open-source, ensuring complete transparency.
                </p>
              </div>

              {/* Feature 4 - Large */}
              <div className="md:col-span-2 glass-panel rounded-3xl p-10 hover:border-indigo-500/30 hover:bg-slate-900/80 transition-all duration-500 group">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                  <svg
                    className="w-6 h-6 text-indigo-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">
                  Dynamic Prize Pools
                </h3>
                <p className="text-slate-400 text-lg leading-relaxed">
                  Participate in rounds with varying stakes and prize pools. 
                  Winners within the tolerance range split the entire pool proportionally based on their stakes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-slate-800 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 group">
                <svg className="w-5 h-5 text-white transform group-hover:rotate-90 transition-transform duration-700 ease-in-out" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L14.4 8.6C14.8 9.7 15.7 10.6 16.8 11L22 12.5L16.8 14C15.7 14.4 14.8 15.3 14.4 16.4L12 23L9.6 16.4C9.2 15.3 8.3 14.4 7.2 14L2 12.5L7.2 11C8.3 10.6 9.2 9.7 9.6 8.6L12 2Z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-slate-200">Only Up</span>
            </div>
            
            <div className="text-slate-500 text-sm">
              © 2024 Only Up. Built for Zama Bounty.
            </div>

            <div className="flex gap-6">
              <a href="#" className="text-slate-400 hover:text-indigo-400 transition-colors">Twitter</a>
              <a href="#" className="text-slate-400 hover:text-indigo-400 transition-colors">Discord</a>
              <a href="#" className="text-slate-400 hover:text-indigo-400 transition-colors">GitHub</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
