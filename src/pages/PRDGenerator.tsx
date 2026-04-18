import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, Download, Copy, Check, FileDown, Smartphone, Globe, Server, Layout } from 'lucide-react';
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

interface PRDTemplate {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  defaults: Partial<PRDFormData>;
}

const templates: PRDTemplate[] = [
  {
    id: 'mobile-app',
    name: 'Mobile App',
    icon: <Smartphone className="h-5 w-5" />,
    description: 'iOS/Android mobile application',
    defaults: {
      targetAudience: 'Mobile users aged 18-45, tech-savvy individuals who prefer on-the-go access',
      keyFeatures: `- User authentication (email, social login)
- Push notifications
- Offline mode support
- In-app purchases or subscriptions
- User profile management
- Analytics and tracking`,
      constraints: `- Must support iOS 14+ and Android 10+
- App size under 100MB
- Battery optimization required
- Comply with App Store and Play Store guidelines`,
      successMetrics: '100k downloads in first 6 months, 4.5+ star rating, 30% DAU/MAU ratio, <2% crash rate',
    },
  },
  {
    id: 'saas',
    name: 'SaaS Platform',
    icon: <Globe className="h-5 w-5" />,
    description: 'Web-based software as a service',
    defaults: {
      targetAudience: 'Small to medium businesses, teams of 5-100 people, decision-makers and end-users',
      keyFeatures: `- Multi-tenant architecture
- Role-based access control (RBAC)
- Team collaboration features
- Subscription billing (Stripe integration)
- Admin dashboard
- API access for integrations
- SSO/SAML authentication`,
      constraints: `- 99.9% uptime SLA
- GDPR and SOC 2 compliance required
- Support for 10,000+ concurrent users
- Data encryption at rest and in transit`,
      successMetrics: '$50k MRR within 12 months, <3% monthly churn, NPS > 50, <24h response time for support',
    },
  },
  {
    id: 'api',
    name: 'API/Backend',
    icon: <Server className="h-5 w-5" />,
    description: 'REST/GraphQL API service',
    defaults: {
      targetAudience: 'Developers, technical teams, third-party integrators, partner companies',
      keyFeatures: `- RESTful and/or GraphQL endpoints
- OAuth 2.0 / API key authentication
- Rate limiting and throttling
- Comprehensive documentation (OpenAPI/Swagger)
- Webhooks for real-time events
- SDK libraries for major languages
- Sandbox environment for testing`,
      constraints: `- <100ms p99 latency
- Support 10,000 requests/second
- 99.99% availability target
- Backward compatibility for 2 major versions
- Comprehensive logging and monitoring`,
      successMetrics: '1,000 active API consumers, 99.99% uptime, <50ms average response time, 90% developer satisfaction',
    },
  },
  {
    id: 'landing-page',
    name: 'Marketing Site',
    icon: <Layout className="h-5 w-5" />,
    description: 'Landing page or marketing website',
    defaults: {
      targetAudience: 'Potential customers, leads, marketing campaign targets, organic search visitors',
      keyFeatures: `- Responsive design (mobile-first)
- SEO optimized structure
- Lead capture forms
- A/B testing capability
- Analytics integration (GA4, Mixpanel)
- CMS for content updates
- Fast loading (<3s)`,
      constraints: `- Lighthouse score > 90
- WCAG 2.1 AA accessibility compliance
- Support all modern browsers
- CDN deployment for global performance
- Cookie consent and privacy compliance`,
      successMetrics: '10,000 unique visitors/month, 5% conversion rate, <2s page load time, <40% bounce rate',
    },
  },
];

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
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [generatedPRD, setGeneratedPRD] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInputChange = (field: keyof PRDFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const applyTemplate = (template: PRDTemplate) => {
    setSelectedTemplate(template.id);
    setFormData(prev => ({
      ...prev,
      ...template.defaults,
    }));
    toast.success(`${template.name} template applied!`);
  };

  const generatePRD = async () => {
    if (!formData.productName || !formData.productDescription) {
      toast.error('Please fill in at least the product name and description');
      return;
    }

    setIsGenerating(true);
    setGeneratedPRD('');

    try {
      const templateInfo = selectedTemplate 
        ? `\n\n**Template Used:** ${templates.find(t => t.id === selectedTemplate)?.name || 'Custom'}`
        : '';

      const prompt = `Generate a professional Product Requirements Document (PRD) based on the following information:

**Product Name:** ${formData.productName}

**Product Description:** ${formData.productDescription}${templateInfo}

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
    setSelectedTemplate(null);
    setGeneratedPRD('');
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="brutal-border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brutal-border h-10 w-10 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                &gt; DOC_GENERATOR
              </span>
              <h1 className="font-display text-xl uppercase mt-0.5">PRD_FORGE</h1>
            </div>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase hidden sm:block">
            STATUS: READY
          </span>
        </div>

        <ScrollArea className="flex-1 pb-20">
          <div className="p-4 space-y-6 max-w-3xl mx-auto">
            {!generatedPRD ? (
              <>
                {/* Templates */}
                <section className="brutal-border">
                  <div className="brutal-border-b p-3">
                    <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                      &gt; QUICK_START_TEMPLATES
                    </span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-foreground">
                    {templates.map((template, idx) => (
                      <button
                        key={template.id}
                        onClick={() => applyTemplate(template)}
                        className={`flex flex-col items-start gap-2 p-4 text-left transition-none ${
                          idx > 1 ? 'brutal-border-t' : ''
                        } ${
                          selectedTemplate === template.id
                            ? 'bg-foreground text-background'
                            : 'hover:bg-foreground hover:text-background'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {template.icon}
                          <span className="font-display text-sm uppercase">{template.name}</span>
                        </div>
                        <span className="font-mono text-[10px] tracking-wider uppercase opacity-70">
                          {template.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Form */}
                <section className="brutal-border">
                  <div className="brutal-border-b p-3">
                    <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                      &gt; PRODUCT_INFO // INPUT_DATA
                    </span>
                  </div>

                  <div className="p-4 space-y-5">
                    <div>
                      <Label htmlFor="productName" className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                        &gt; PRODUCT_NAME *
                      </Label>
                      <Input
                        id="productName"
                        placeholder="TASKFLOW_PRO"
                        value={formData.productName}
                        onChange={(e) => handleInputChange('productName', e.target.value)}
                        className="brutal-border bg-background mt-2 font-mono uppercase tracking-wider text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="productDescription" className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                        &gt; DESCRIPTION *
                      </Label>
                      <Textarea
                        id="productDescription"
                        placeholder="Describe what your product does..."
                        value={formData.productDescription}
                        onChange={(e) => handleInputChange('productDescription', e.target.value)}
                        rows={3}
                        className="brutal-border bg-background mt-2 font-sans text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="targetAudience" className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                        &gt; TARGET_AUDIENCE
                      </Label>
                      <Input
                        id="targetAudience"
                        placeholder="Small business owners, remote teams..."
                        value={formData.targetAudience}
                        onChange={(e) => handleInputChange('targetAudience', e.target.value)}
                        className="brutal-border bg-background mt-2 font-sans text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="problemStatement" className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                        &gt; PROBLEM_STATEMENT
                      </Label>
                      <Textarea
                        id="problemStatement"
                        placeholder="What problem does this product solve?"
                        value={formData.problemStatement}
                        onChange={(e) => handleInputChange('problemStatement', e.target.value)}
                        rows={2}
                        className="brutal-border bg-background mt-2 font-sans text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="keyFeatures" className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                        &gt; KEY_FEATURES
                      </Label>
                      <Textarea
                        id="keyFeatures"
                        placeholder="List the main features (one per line)..."
                        value={formData.keyFeatures}
                        onChange={(e) => handleInputChange('keyFeatures', e.target.value)}
                        rows={3}
                        className="brutal-border bg-background mt-2 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <Label htmlFor="successMetrics" className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                        &gt; SUCCESS_METRICS
                      </Label>
                      <Input
                        id="successMetrics"
                        placeholder="10K_DAU // 95%_UPTIME // NPS>50"
                        value={formData.successMetrics}
                        onChange={(e) => handleInputChange('successMetrics', e.target.value)}
                        className="brutal-border bg-background mt-2 font-mono uppercase tracking-wider text-xs"
                      />
                    </div>

                    <div>
                      <Label htmlFor="timeline" className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                        &gt; TIMELINE
                      </Label>
                      <Select
                        value={formData.timeline}
                        onValueChange={(value) => handleInputChange('timeline', value)}
                      >
                        <SelectTrigger className="brutal-border bg-background mt-2 font-mono uppercase tracking-wider text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="brutal-border bg-background font-mono uppercase tracking-wider">
                          <SelectItem value="1 month">1_MONTH</SelectItem>
                          <SelectItem value="3 months">3_MONTHS</SelectItem>
                          <SelectItem value="6 months">6_MONTHS</SelectItem>
                          <SelectItem value="1 year">1_YEAR</SelectItem>
                          <SelectItem value="18 months">18_MONTHS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="constraints" className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                        &gt; CONSTRAINTS
                      </Label>
                      <Textarea
                        id="constraints"
                        placeholder="Budget, technical limits, regulations..."
                        value={formData.constraints}
                        onChange={(e) => handleInputChange('constraints', e.target.value)}
                        rows={2}
                        className="brutal-border bg-background mt-2 font-sans text-sm"
                      />
                    </div>

                    <Button
                      onClick={generatePRD}
                      disabled={isGenerating}
                      className="btn-brutal w-full h-12 tracking-widest text-sm"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          GENERATING...
                        </>
                      ) : (
                        '[ EXECUTE_GENERATE ]'
                      )}
                    </Button>
                  </div>
                </section>
              </>
            ) : (
              <div className="space-y-4">
                <div className="brutal-border-b pb-3 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
                      &gt; OUTPUT_DOCUMENT
                    </span>
                    <h2 className="font-display text-2xl uppercase mt-1">GENERATED_PRD</h2>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={copyToClipboard} className="brutal-border font-mono text-xs uppercase tracking-widest">
                      {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      COPY
                    </Button>
                    <Button variant="ghost" size="sm" onClick={downloadMarkdown} className="brutal-border font-mono text-xs uppercase tracking-widest">
                      <Download className="h-4 w-4 mr-1" />
                      MD
                    </Button>
                    <Button variant="ghost" size="sm" onClick={downloadPDF} className="brutal-border font-mono text-xs uppercase tracking-widest">
                      <FileDown className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetForm} className="brutal-border font-mono text-xs uppercase tracking-widest">
                      NEW
                    </Button>
                  </div>
                </div>

                <section className="brutal-border p-5 bg-background">
                  <div className="font-sans text-sm whitespace-pre-wrap leading-relaxed">
                    {generatedPRD}
                  </div>
                </section>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </AppLayout>
  );
}

