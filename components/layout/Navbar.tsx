"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { FheStatus } from "@/components/fhe/FheStatus";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Predict", href: "/predict" },
    { name: "History", href: "/history" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
        scrolled
          ? "bg-slate-950/80 backdrop-blur-xl border-slate-800 shadow-lg shadow-indigo-500/5"
          : "bg-transparent border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 bg-indigo-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-300" />
              <div className="relative w-full h-full bg-slate-900 rounded-xl flex items-center justify-center border border-slate-700 shadow-inner group-hover:border-indigo-500/50 transition-colors">
                {/* Custom Hand-Drawn Polaris Icon */}
                <svg
                  className="w-6 h-6 text-indigo-400 transform group-hover:rotate-90 transition-transform duration-700 ease-in-out"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2L14.4 8.6C14.8 9.7 15.7 10.6 16.8 11L22 12.5L16.8 14C15.7 14.4 14.8 15.3 14.4 16.4L12 23L9.6 16.4C9.2 15.3 8.3 14.4 7.2 14L2 12.5L7.2 11C8.3 10.6 9.2 9.7 9.6 8.6L12 2Z" />
                </svg>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-100 leading-none group-hover:text-white transition-colors">
                Only Up
              </span>
              <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase group-hover:text-indigo-400 transition-colors">
                FHE Prediction
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-full border border-slate-800 backdrop-blur-sm">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      isActive
                        ? "bg-indigo-500/10 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.1)] border border-indigo-500/20"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Wallet Connection */}
          <div className="flex items-center gap-4">
            <FheStatus />
            <div className="transform hover:scale-105 transition-transform duration-200">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
