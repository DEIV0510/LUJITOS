import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { DemoHome } from '@/features/home/DemoHome';
import { LiveHome } from '@/features/home/LiveHome';

export default function HomeScreen() {
  const { mode } = useFinanceData();
  return mode === 'demo' ? <DemoHome /> : <LiveHome />;
}
