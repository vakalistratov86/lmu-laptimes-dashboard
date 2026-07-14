import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { DriverFilterProvider } from "@/lib/driverFilter";
import NotFound from "@/pages/not-found";
import Overview from "@/pages/Overview";
import Laps from "@/pages/Laps";
import Leaderboards from "@/pages/Leaderboards";
import Reports from "@/pages/Reports";
import Tracks from "@/pages/Tracks";
import TrackDetail from "@/pages/TrackDetail";
import Sessions from "@/pages/Sessions";
import SessionDetail from "@/pages/SessionDetail";
import Import from "@/pages/Import";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Overview} />
      <Route path="/laps" component={Laps} />
      <Route path="/leaderboards" component={Leaderboards} />
      <Route path="/reports" component={Reports} />
      <Route path="/tracks" component={Tracks} />
      <Route path="/tracks/:id" component={TrackDetail} />
      <Route path="/sessions" component={Sessions} />
      <Route path="/sessions/:id" component={SessionDetail} />
      <Route path="/import" component={Import} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}

export default App;
