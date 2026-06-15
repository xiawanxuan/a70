import LeftPanel from '../components/LeftPanel';
import CenterCanvas from '../components/CenterCanvas';
import RightPanel from '../components/RightPanel';

export default function Home() {
  return (
    <div className="h-screen w-screen flex overflow-hidden bg-gray-50">
      <LeftPanel />
      <CenterCanvas />
      <RightPanel />
    </div>
  );
}
