import { createFileRoute } from "@tanstack/react-router";
import { NavigationChoiceSheet } from "@/components/mission/NavigationChoiceSheet";

export const Route = createFileRoute("/test-nav-sheet")({
  component: TestNavSheet,
});

function TestNavSheet() {
  return (
    <div className="min-h-screen bg-[#0b1026]">
      <NavigationChoiceSheet destination="6 rue du pont libert, 37520 La Riche" onClose={() => {}} />
    </div>
  );
}