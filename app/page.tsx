import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/shared/loading-spinner"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-primary">
            544 Cereri Informații Publice
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Platformă pentru gestionarea cererilor de informații publice conform Legii 544/2001
          </p>
          <div className="flex gap-4 justify-center">
            <Button>Autentificare</Button>
            <Button variant="outline">Înregistrare</Button>
          </div>
        </div>

        {/* Component Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Buttons Card */}
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>Different button variants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full">Primary</Button>
              <Button variant="secondary" className="w-full">Secondary</Button>
              <Button variant="outline" className="w-full">Outline</Button>
              <Button variant="destructive" className="w-full">Destructive</Button>
              <Button variant="ghost" className="w-full">Ghost</Button>
              <Button variant="link" className="w-full">Link</Button>
            </CardContent>
          </Card>

          {/* Badges Card */}
          <Card>
            <CardHeader>
              <CardTitle>Status Badges</CardTitle>
              <CardDescription>Request status indicators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="pending">⚪ Pending</Badge>
                <Badge variant="received">🔵 Received</Badge>
                <Badge variant="extension">🟡 Extension</Badge>
                <Badge variant="answered">🟢 Answered</Badge>
                <Badge variant="delayed">🔴 Delayed</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Form Inputs Card */}
          <Card>
            <CardHeader>
              <CardTitle>Form Inputs</CardTitle>
              <CardDescription>Input components</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nume</Label>
                <Input id="name" placeholder="Ion Popescu" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ion.popescu@implicarecivica.ro"
                  disabled
                />
              </div>
            </CardContent>
          </Card>

          {/* Loading States Card */}
          <Card>
            <CardHeader>
              <CardTitle>Loading States</CardTitle>
              <CardDescription>Spinner components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 justify-center py-4">
                <LoadingSpinner size="sm" />
                <LoadingSpinner size="md" />
                <LoadingSpinner size="lg" />
              </div>
            </CardContent>
          </Card>

          {/* Design System Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Design System</CardTitle>
              <CardDescription>Color palette and typography</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="h-12 rounded bg-primary"></div>
                  <p className="text-xs text-center">Primary</p>
                </div>
                <div className="space-y-2">
                  <div className="h-12 rounded bg-secondary"></div>
                  <p className="text-xs text-center">Secondary</p>
                </div>
                <div className="space-y-2">
                  <div className="h-12 rounded bg-success"></div>
                  <p className="text-xs text-center">Success</p>
                </div>
                <div className="space-y-2">
                  <div className="h-12 rounded bg-warning"></div>
                  <p className="text-xs text-center">Warning</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge>Next.js 15</Badge>
              <Badge>TypeScript</Badge>
              <Badge>Tailwind CSS</Badge>
              <Badge>Supabase</Badge>
              <Badge>shadcn/ui</Badge>
              <Badge>Mistral AI</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
