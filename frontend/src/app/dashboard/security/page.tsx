"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Key,
  MapPin,
  Smartphone,
  DownloadCloud,
  Lock,
} from "lucide-react";

export default function SecurityPage() {
  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center bg-black text-white p-6 shadow-[8px_8px_0px_0px_rgba(200,200,200,1)]">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">
            Enterprise Security
          </h1>
          <p className="text-gray-300 font-medium">
            Manage access controls, API keys, and session activity.
          </p>
        </div>
        <Button className="font-bold text-md tracking-wider bg-terminal-green text-black hover:bg-terminal-green/80 border-2 border-terminal-green flex gap-2">
          <DownloadCloud size={20} /> DOWNLAOD COMPLIANCE REPORT
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Authentication Options */}
        <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black">
          <CardHeader className="bg-gray-50 border-b-4 border-black flex flex-row items-center gap-3">
            <Shield size={24} />
            <CardTitle>Authentication Constraints</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="border-2 border-dashed border-gray-300 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Smartphone size={20} className="text-black" />
                  <span className="font-bold text-sm uppercase">
                    Two-Factor Authentication (2FA)
                  </span>
                </div>
                <span className="px-2 py-1 text-[10px] tracking-wider font-extrabold uppercase border-2 bg-green-100 border-green-800 text-green-800">
                  ENFORCED
                </span>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-4">
                Requires all Admins and Accountants to use an Authenticator App
                to access this workspace.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="font-bold text-xs bg-transparent border-2 border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-black w-full"
              >
                DISABLE MULTI-FACTOR AUTH
              </Button>
            </div>

            <div className="border-2 border-dashed border-gray-300 p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin size={20} className="text-gray-400" />
                  <span className="font-bold text-sm uppercase text-gray-500">
                    IP Whitelisting
                  </span>
                </div>
                <span className="px-2 py-1 text-[10px] tracking-wider font-extrabold uppercase border-2 bg-gray-200 border-gray-400 text-gray-500">
                  DISABLED
                </span>
              </div>
              <p className="text-xs font-medium text-gray-500 mb-4">
                Restrict login to corporate network IP addresses only.
              </p>
              <Button
                size="sm"
                className="font-bold text-xs bg-terminal-green text-black hover:bg-terminal-green/80 border-2 border-terminal-green w-full"
              >
                ENABLE RULE
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black">
          <CardHeader className="bg-gray-50 border-b-4 border-black flex flex-row items-center gap-3">
            <Key size={24} />
            <CardTitle>Developer API Keys</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <p className="text-sm font-medium text-gray-500">
              Use these keys to authenticate external scripts or custom ERP
              bridge clients against the Ghost Backend.
            </p>

            <div className="bg-black text-white p-4 font-mono text-sm relative group border-l-4 border-blue-500">
              <div className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">
                Production Key - ERP Bridge
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-50 blur-[2px] select-none group-hover:blur-none group-hover:opacity-100 transition-all font-bold tracking-wider">
                  gh_live_49f829d...a9f1
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-terminal-red hover:text-black border border-terminal-red hover:bg-terminal-red"
                >
                  REVOKE
                </Button>
              </div>
            </div>

            <Button className="font-bold text-xs w-full bg-terminal-green text-black border-2 border-terminal-green hover:bg-terminal-green/80">
              GENERATE NEW KEY
            </Button>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <div className="md:col-span-2">
          <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black">
            <CardHeader className="bg-gray-50 border-b-4 border-black flex flex-row items-center gap-3">
              <Lock size={24} />
              <CardTitle>Active Gateway Sessions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-black uppercase bg-gray-100 border-b-2 border-black font-bold">
                  <tr>
                    <th className="px-6 py-4">Device / Browser</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4">Last Active</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 bg-white">
                    <td className="px-6 py-4 font-bold">
                      <div className="text-sm">Mac OS X • Chrome</div>
                      <div className="text-[10px] text-green-600 uppercase tracking-widest mt-1">
                        Current Session
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500">
                      192.168.1.42
                    </td>
                    <td className="px-6 py-4 font-bold">Just now</td>
                    <td className="px-6 py-4 text-right"></td>
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="px-6 py-4 font-bold">
                      <div className="text-sm">Windows 11 • Edge</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500">
                      104.28.199.14
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-500">
                      2 days ago
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-bold border-2 border-terminal-red text-terminal-red bg-transparent hover:bg-terminal-red hover:text-black text-xs"
                      >
                        TERMINATE
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
