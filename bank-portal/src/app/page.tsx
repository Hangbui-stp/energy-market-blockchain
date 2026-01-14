"use client";

import BankDashboard from "../components/BankDashboard";
import { Web3Provider } from "../components/Web3";

export default function Home() {
  return (
    <Web3Provider>
      <BankDashboard />
    </Web3Provider>
  );
}