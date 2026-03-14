"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, ShieldAlert, ArrowRight } from "lucide-react";

const mockUsers: any[] = [];

export default function UsersPage() {
  const [newUser, setNewUser] = useState(false);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center bg-black text-white p-6 shadow-[8px_8px_0px_0px_rgba(200,200,200,1)]">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tighter">
            Team & Access
          </h1>
          <p className="text-gray-300 font-medium">
            Control roles, permissions, and approval hierarchies.
          </p>
        </div>
        <Button
          onClick={() => setNewUser(!newUser)}
          className="font-bold text-md tracking-wider bg-white text-black hover:bg-gray-200 border-2 border-white flex gap-2"
        >
          <Plus size={20} /> ADD TEAM MEMBER
        </Button>
      </div>

      {newUser && (
        <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black bg-blue-50">
          <CardHeader className="bg-blue-100 border-b-4 border-black">
            <CardTitle className="text-blue-900">Invite New User</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                  Full Name
                </label>
                <Input
                  placeholder="e.g. Jane Doe"
                  className="font-bold h-12 border-2 border-black bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                  Email Address
                </label>
                <Input
                  placeholder="jane@company.com"
                  type="email"
                  className="font-bold h-12 border-2 border-black bg-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                  System Role
                </label>
                <select className="flex h-12 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2">
                  <option>Accountant (Can edit & approve)</option>
                  <option>Viewer (Read-only)</option>
                  <option>Admin (Full system access)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">
                  Approval Limit
                </label>
                <select className="flex h-12 w-full border-2 border-black bg-white px-3 py-2 text-sm font-bold uppercase outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2">
                  <option>Up to $10,000</option>
                  <option>Up to $50,000</option>
                  <option>Unlimited</option>
                  <option>No Approval Rights</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-4 border-t-2 border-dashed border-gray-400 pt-4">
              <Button
                variant="outline"
                className="font-bold border-black"
                onClick={() => setNewUser(false)}
              >
                CANCEL
              </Button>
              <Button className="font-bold bg-blue-700 hover:bg-blue-800 text-white border-black">
                SEND INVITATION
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* User List */}
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black">
            <CardHeader className="bg-gray-50 border-b-4 border-black flex flex-row items-center gap-2">
              <Users size={24} />
              <CardTitle>Active Directory</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-black uppercase bg-gray-100 border-b-2 border-black font-bold">
                  <tr>
                    <th className="px-6 py-4">User Details</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Manage</th>
                  </tr>
                </thead>
                <tbody>
                  {mockUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-200 hover:bg-gray-50 bg-white"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-lg">{user.name}</div>
                        <div className="font-mono text-gray-500 text-xs">
                          {user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-[10px] tracking-wider font-extrabold uppercase border-2 ${
                            user.role === "ADMIN"
                              ? "bg-red-100 border-red-800 text-red-800"
                              : user.role === "ACCOUNTANT"
                                ? "bg-blue-100 border-blue-800 text-blue-800"
                                : "bg-gray-100 border-gray-800 text-gray-800"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold">
                        {user.status === "Active" ? (
                          <span className="text-green-600">Active</span>
                        ) : (
                          <span className="text-yellow-600 animate-pulse">
                            Pending...
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          className="font-bold text-xs underline decoration-2 underline-offset-4"
                        >
                          EDIT
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Enterprise Workflow Module */}
        <div className="space-y-6">
          <Card className="shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-4 border-black bg-[#fafafa]">
            <CardHeader className="bg-purple-100 border-b-4 border-purple-900 border-black flex flex-row items-center gap-2">
              <ShieldAlert size={24} className="text-purple-900" />
              <CardTitle className="text-purple-900">
                Enterprise Workflows
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <p className="text-sm font-medium text-purple-900">
                Configure multi-tiered approval chains based on total invoice
                value.
              </p>

              <div className="space-y-4">
                <div className="bg-white border-2 border-black p-4 space-y-2">
                  <h4 className="font-bold uppercase text-xs text-gray-500">
                    Tier 1: Up to $10,000
                  </h4>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <span className="bg-blue-100 text-blue-900 px-2 border-blue-900 border">
                      ACCOUNTANT
                    </span>
                    <ArrowRight size={16} />
                    <span className="bg-green-100 text-green-900 px-2 border-green-900 border">
                      ERP
                    </span>
                  </div>
                </div>

                <div className="bg-white border-2 border-black p-4 space-y-2">
                  <h4 className="font-bold uppercase text-xs text-gray-500">
                    Tier 2: $10,000 - $50,000
                  </h4>
                  <div className="flex items-center gap-2 font-bold text-sm flex-wrap">
                    <span className="bg-blue-100 text-blue-900 px-2 border-blue-900 border">
                      ACCOUNTANT
                    </span>
                    <ArrowRight size={16} />
                    <span className="bg-red-100 text-red-900 px-2 border-red-900 border">
                      ADMIN
                    </span>
                    <ArrowRight size={16} />
                    <span className="bg-green-100 text-green-900 px-2 border-green-900 border">
                      ERP
                    </span>
                  </div>
                </div>

                <div className="bg-white border-2 border-black p-4 space-y-2 opacity-50">
                  <h4 className="font-bold uppercase text-xs text-gray-500">
                    Tier 3: $50,000+
                  </h4>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    Add Custom Rule...
                  </div>
                </div>
              </div>

              <Button className="w-full font-bold uppercase tracking-widest bg-purple-900 text-white hover:bg-purple-800">
                EDIT CHAINS
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
