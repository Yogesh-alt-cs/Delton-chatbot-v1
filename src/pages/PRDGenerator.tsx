import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, Download, Copy, Check, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import jsPDF from 'jspdf';

interface PRDFormData {
  productName: string;
  productDescription: string;
  targetAudience: string;
  problemStatement: string;
  keyFeatures: string;
  successMetrics: string;
  timeline: string;
  constraints: string;
}

const initialFormData: PRDFormData = {
  productName: '',
  productDescription: '',
  targetAudience: '',
  problemStatement: '',
  keyFeatures: '',
  successMetrics: '',
  timeline: '3 months',
  constraints: '',
};

export default function PRDGenerator() {
  const [formData, setFormData] = useState<PRDFormData>(initialFormData);
  const [generatedPRD, setGeneratedPRD] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInputChange = (field: keyof PRDFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generatePRD = async () => {
    if (!formData.productName || !formData.productDescription) {
      toast.error('Please fill in at least the product name and description');
      return;
    }

    setIsGenerating(true);
    setGeneratedPRD('');

    try {
      const prompt = `Generate a professional Product Requirements Document (PRD) based on the following information:

**Product Name:** ${formData.productName}

**Product Description:** ${formData.productDescription}

**Target Audience:** ${formData.targetAudience || 'Not specified'}

**Problem Statement:** ${formData.problemStatement || 'Not specified'}

**Key Features:** ${formData.keyFeatures || 'Not specified'}

**Success Metrics:** ${formData.successMetrics || 'Not specified'}

**Timeline:** ${formData.timeline}

**Constraints:** ${formData.constraints || 'None specified'}

Please create a comprehensive PRD with the following sections:
1. Executive Summary
2. Product Overview
3. Goals and Objectives
4. Target Users and Personas
5. User Stories and Use Cases
6. Functional Requirements
7. Non-Functional Requirements
8. Technical Requirements
9. Success Metrics and KPIs
10. Timeline and Milestones
11. Risks and Mitigation
12. Appendix

Format the document professionally with clear headings and bullet points where appropriate.`;

      const { data, error } = await supabase.functions.invoke('unified-ai', {
        body: {
          messages: [{ role: 'user', content: prompt }],
          conversationId: 'prd-generator',
        },
      });

      if (error) throw error;

      // Parse SSE response
      const text = typeof data === 'string' ? data : '';
      const lines = text.split('\n');
      let content = '';

      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const jsonStr = line.slice(6);
            const parsed = JSON.parse(jsonStr);
            content += parsed.choices?.[0]?.delta?.content || '';
          } catch {
            // Skip non-JSON lines
          }
        }
      }

      if (content) {
        setGeneratedPRD(content);
        toast.success('PRD generated successfully!');
      } else {
        throw new Error('No content received');
      }
    } catch (error) {
      console.error('PRD generation error:', error);
      toast.error('Failed to generate PRD. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedPRD);
    setCopied(true);
    toast.success('PRD copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([generatedPRD], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.productName.replace(/\s+/g, '-').toLowerCase()}-prd.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Markdown downloaded!');
  };

  const downloadPDF = () => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let yPosition = margin;

    // Title
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${formData.productName} - PRD`, margin, yPosition);
    yPosition += 12;

    // Date
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100);
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPosition);
    yPosition += 10;
    pdf.setTextColor(0);

    // Divider
    pdf.setDrawColor(200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Content
    const lines = generatedPRD.split('\n');
    
    for (const line of lines) {
      // Check for page overflow
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }

      const trimmedLine = line.trim();
      
      // Handle headings
      if (trimmedLine.startsWith('# ')) {
        yPosition += 5;
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        const text = trimmedLine.replace(/^#+\s*/, '');
        pdf.text(text, margin, yPosition);
        yPosition += 8;
      } else if (trimmedLine.startsWith('## ')) {
        yPosition += 4;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        const text = trimmedLine.replace(/^#+\s*/, '');
        pdf.text(text, margin, yPosition);
        yPosition += 7;
      } else if (trimmedLine.startsWith('### ')) {
        yPosition += 3;
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        const text = trimmedLine.replace(/^#+\s*/, '');
        pdf.text(text, margin, yPosition);
        yPosition += 6;
      } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        const text = trimmedLine.replace(/\*\*/g, '');
        const splitText = pdf.splitTextToSize(text, maxWidth);
        pdf.text(splitText, margin, yPosition);
        yPosition += splitText.length * 5 + 2;
      } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const text = '• ' + trimmedLine.replace(/^[-•]\s*/, '');
        const splitText = pdf.splitTextToSize(text, maxWidth - 5);
        pdf.text(splitText, margin + 5, yPosition);
        yPosition += splitText.length * 4.5 + 1;
      } else if (trimmedLine.match(/^\d+\.\s/)) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const splitText = pdf.splitTextToSize(trimmedLine, maxWidth - 5);
        pdf.text(splitText, margin + 5, yPosition);
        yPosition += splitText.length * 4.5 + 1;
      } else if (trimmedLine) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        const cleanText = trimmedLine.replace(/\*\*/g, '').replace(/\*/g, '');
        const splitText = pdf.splitTextToSize(cleanText, maxWidth);
        pdf.text(splitText, margin, yPosition);
        yPosition += splitText.length * 4.5 + 1;
      } else {
        yPosition += 3;
      }
    }

    pdf.save(`${formData.productName.replace(/\s+/g, '-').toLowerCase()}-prd.pdf`);
    toast.success('PDF downloaded!');
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setGeneratedPRD('');
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">PRD Generator</h1>
            <p className="text-xs text-muted-foreground">Create professional Product Requirements Documents</p>
          </div>
        </div>

        <ScrollArea className="flex-1 pb-20">
          <div className="p-4 space-y-6">
            {!generatedPRD ? (
              <Card>
                <CardHeader>
                  <CardTitle>Product Information</CardTitle>
                  <CardDescription>
                    Fill in the details below to generate a comprehensive PRD
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Product Name *</Label>
                    <Input
                      id="productName"
                      placeholder="e.g., TaskFlow Pro"
                      value={formData.productName}
                      onChange={(e) => handleInputChange('productName', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="productDescription">Product Description *</Label>
                    <Textarea
                      id="productDescription"
                      placeholder="Briefly describe what your product does..."
                      value={formData.productDescription}
                      onChange={(e) => handleInputChange('productDescription', e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetAudience">Target Audience</Label>
                    <Input
                      id="targetAudience"
                      placeholder="e.g., Small business owners, remote teams"
                      value={formData.targetAudience}
                      onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="problemStatement">Problem Statement</Label>
                    <Textarea
                      id="problemStatement"
                      placeholder="What problem does your product solve?"
                      value={formData.problemStatement}
                      onChange={(e) => handleInputChange('problemStatement', e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keyFeatures">Key Features</Label>
                    <Textarea
                      id="keyFeatures"
                      placeholder="List the main features (one per line)..."
                      value={formData.keyFeatures}
                      onChange={(e) => handleInputChange('keyFeatures', e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="successMetrics">Success Metrics</Label>
                    <Input
                      id="successMetrics"
                      placeholder="e.g., 10k DAU, 95% uptime, NPS > 50"
                      value={formData.successMetrics}
                      onChange={(e) => handleInputChange('successMetrics', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeline">Timeline</Label>
                    <Select
                      value={formData.timeline}
                      onValueChange={(value) => handleInputChange('timeline', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 month">1 Month</SelectItem>
                        <SelectItem value="3 months">3 Months</SelectItem>
                        <SelectItem value="6 months">6 Months</SelectItem>
                        <SelectItem value="1 year">1 Year</SelectItem>
                        <SelectItem value="18 months">18 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="constraints">Constraints & Limitations</Label>
                    <Textarea
                      id="constraints"
                      placeholder="Budget, technical limitations, regulatory requirements..."
                      value={formData.constraints}
                      onChange={(e) => handleInputChange('constraints', e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button
                    onClick={generatePRD}
                    disabled={isGenerating}
                    className="w-full"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating PRD...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Generate PRD
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Generated PRD</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyToClipboard} title="Copy">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadMarkdown} title="Download Markdown">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadPDF} title="Download PDF">
                      <FileDown className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={resetForm}>
                      New PRD
                    </Button>
                  </div>
                </div>

                <Card>
                  <CardContent className="p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {generatedPRD}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </AppLayout>
  );
}
