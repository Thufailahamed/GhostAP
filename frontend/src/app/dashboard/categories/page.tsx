"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Plus, Trash2, FolderTree } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";

type Category = {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string | null;
};

export default function CategoriesPage() {
  const { showConfirm } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const [newCat, setNewCat] = useState({
    code: "",
    name: "",
    type: "Expense",
    description: "",
  });

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/categories/");
      setCategories(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load categories.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/categories/", newCat);
      setNewCat({ code: "", name: "", type: "Expense", description: "" });
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create category.");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm("Delete this category?");
    if (!confirmed) return;
    setError("");
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete category.");
    }
  };

  const filteredCategories =
    filterType === "ALL"
      ? categories
      : categories.filter((c) => c.type.toUpperCase() === filterType);

  const getBadgeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case "REVENUE":
        return "text-terminal-cyan border-terminal-cyan";
      case "EXPENSE":
        return "text-terminal-amber border-terminal-amber";
      case "ASSET":
        return "text-terminal-green border-terminal-green";
      case "LIABILITY":
        return "text-terminal-red border-terminal-red";
      case "EQUITY":
        return "text-white border-white";
      default:
        return "text-terminal-green border-terminal-green";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b-2 border-terminal-green pb-4">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-widest text-terminal-green flex items-center gap-3">
            <FolderTree size={28} />
            CHART_OF_ACCOUNTS
          </h1>
          <p className="text-terminal-green/50 font-mono mt-1 tracking-widest text-xs uppercase">
            Finance OS // General Ledger Categorization
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-terminal-red/10 border-2 border-terminal-red p-4 flex gap-4 text-terminal-red items-center">
          <AlertCircle className="flex-shrink-0" />
          <p className="font-bold uppercase tracking-wider text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* CREATE NEW FORM */}
        <form
          onSubmit={handleCreate}
          className="border-2 border-terminal-green bg-terminal-panel p-6 space-y-4"
        >
          <h3 className="font-bold uppercase tracking-widest text-terminal-green border-b border-terminal-green/30 pb-2">
            Register New Account
          </h3>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-terminal-green/70">
              Account Code
            </label>
            <Input
              required
              value={newCat.code}
              onChange={(e) => setNewCat({ ...newCat, code: e.target.value })}
              placeholder="e.g. 5000"
              className="bg-transparent border-terminal-green text-terminal-green font-mono uppercase focus-visible:ring-terminal-amber rounded-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-terminal-green/70">
              Account Name
            </label>
            <Input
              required
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              placeholder="e.g. Office Supplies"
              className="bg-transparent border-terminal-green text-terminal-green font-mono focus-visible:ring-terminal-amber rounded-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-terminal-green/70">
              Account Type
            </label>
            <select
              required
              value={newCat.type}
              onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}
              className="w-full h-10 border border-terminal-green bg-terminal-bg text-terminal-green font-mono outline-none px-3 focus:border-terminal-amber rounded-none"
            >
              <option value="Expense">Expense</option>
              <option value="Revenue">Revenue</option>
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
              <option value="Equity">Equity</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-terminal-green/70">
              Description (Optional)
            </label>
            <Input
              value={newCat.description}
              onChange={(e) =>
                setNewCat({ ...newCat, description: e.target.value })
              }
              className="bg-transparent border-terminal-green text-terminal-green font-mono focus-visible:ring-terminal-amber rounded-none"
            />
          </div>
          <Button
            type="submit"
            className="w-full mt-4 bg-terminal-green text-black hover:bg-terminal-green border-none flex items-center justify-center gap-2"
          >
            <Plus size={16} /> ADD ACCOUNT
          </Button>
        </form>

        {/* LIST / TABLE */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {["ALL", "REVENUE", "EXPENSE", "ASSET", "LIABILITY", "EQUITY"].map(
              (type) => (
                <Button
                  key={type}
                  type="button"
                  variant={filterType === type ? "default" : "outline"}
                  onClick={() => setFilterType(type)}
                  className={`flex-shrink-0 ${filterType === type ? "bg-terminal-green text-black border-none" : "bg-transparent text-terminal-green border-terminal-green/50 hover:border-terminal-green"}`}
                >
                  {type}
                </Button>
              ),
            )}
          </div>

          <div className="border-2 border-terminal-green bg-terminal-panel">
            <table className="w-full text-sm text-left text-terminal-green font-mono">
              <thead className="bg-[#111] border-b-2 border-terminal-green text-xs uppercase font-bold tracking-widest text-terminal-green/70">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Account Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-terminal-green/50 uppercase tracking-widest animate-pulse"
                    >
                      LOADING LEDGER_DATA...
                    </td>
                  </tr>
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-terminal-green/50 uppercase tracking-widest"
                    >
                      [ NO ACCOUNTS FOUND ]
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => (
                    <tr
                      key={cat.id}
                      className="border-b border-[#333] hover:bg-terminal-green/5 transition-colors group"
                    >
                      <td className="px-4 py-3 font-bold">{cat.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold">{cat.name}</div>
                        {cat.description && (
                          <div className="text-xs text-terminal-green/50 mt-1">
                            {cat.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 border text-xs font-bold uppercase tracking-widest bg-transparent ${getBadgeColor(cat.type)}`}
                        >
                          {cat.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => handleDelete(cat.id)}
                          className="text-terminal-red hover:text-black hover:bg-terminal-red h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
