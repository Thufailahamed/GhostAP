"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await api.post("/invoices/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setIsUploading(false);
      if (response.data?.data?.invoice_id) {
        router.push(`/dashboard/invoices/${response.data.data.invoice_id}`);
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Upload failed", err);
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 mt-10">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tighter text-terminal-green">
          Upload Invoice
        </h1>
        <p className="text-terminal-amber font-medium">
          Extract structured data using AI ghost instantly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drop PDF</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-6">
            <div
              className={`border-2 border-dashed transition-colors p-12 text-center flex flex-col items-center justify-center cursor-pointer ${file ? "border-terminal-green bg-terminal-green/5" : "border-terminal-green/50 bg-transparent hover:bg-terminal-green/5"}`}
            >
              <UploadCloud size={48} className="mb-4 text-terminal-green" />
              <p className="text-lg font-bold mb-2 uppercase text-terminal-green">
                {file ? file.name : "Select or drag file"}
              </p>
              <p className="text-sm text-terminal-green/50 font-mono">
                Supports PDF, PNG, JPEG up to 10MB
              </p>
              <input
                type="file"
                className="hidden"
                id="file-upload"
                accept=".pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <label htmlFor="file-upload" className="mt-6">
                <Button
                  variant="outline"
                  type="button"
                  className="pointer-events-none text-sm tracking-wider"
                >
                  Browse Files
                </Button>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full text-lg tracking-wider"
              disabled={!file || isUploading}
            >
              {isUploading ? "Extracting..." : "Process Invoice"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
