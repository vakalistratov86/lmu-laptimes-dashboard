import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { DriverFilterProvider } from "@/lib/driverFilter";
import { LanguageProvider } from "@/lib/i18n";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/Overview";
import Leaderboards from "@/pages/Leaderboards";
import Tracks from "@/pages/Tracks";
import TrackDetail from "@/pages/TrackDetail";
import Sessions from "@/pages/Sessions";
import SessionDetail from "@/pages/SessionDetail";
import Telemetry from "@/pages/Telemetry";
import TelemetryDetail from "@/pages/TelemetryDetail";
import Import from "@/pages/Import";
import Events from "@/pages/Events";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Overview} />
      <Route path="/leaderboards" component={Leaderboards} />
      <Route path="/tracks" component={Tracks} />
      <Route path="/tracks/:id" component={TrackDetail} />
      <Route path="/sessions" component={Sessions} />
      <Route path="/sessions/:id" component={SessionDetail} />
      <Route path="/telemetry" component={Telemetry} />
      <Route path="/telemetry/:id" component={TelemetryDetail} />
      <Route path="/events" component={Events} />
      <Route path="/import" component={Import} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <DriverFilterProvider>
            <Router hook={useHashLocation}>
              <AppLayout>
                <AppRouter />
              </AppLayout>
            </Router>
          </DriverFilterProvider>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
