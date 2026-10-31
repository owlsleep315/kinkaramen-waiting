import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, BookOpen, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { MODEL } from '../models/modelConstants';
export function ModelExplanation() {
  const [open, setOpen] = useState(false);
  return <Collapsible.Root className="card model-card" open={open} onOpenChange={setOpen}><Collapsible.Trigger className="model-trigger"><span className="model-title"><BookOpen size={19}/><span>어떻게 예측하나요?<small>실측 기록에 따른 예측 방법</small></span></span><ChevronDown size={20} className={open ? 'rotate' : ''}/></Collapsible.Trigger><Collapsible.Content className="model-content">
    <div className="model-intro"><ShieldCheck size={19}/><span>내 기록은 이 브라우저에서만 사용해요.</span></div>
    <h3>직접 측정한 데이터를 바탕으로 예측해요</h3><p>2026년 10월 29일과 30일, 이틀 간 직접 웨이팅 순서 변화를 기록했어요. 해당 구간에서 측정한 47구간, 223분 동안의 72칸 감소를 반영해 필요한 계수를 정하고, 이를 바탕으로 예상 호출 시간을 계산해요.</p>
    <h3>앞 팀이 많으면 줄어들 기회도 많아요</h3><p>기준 서비스 성분은 분당 {MODEL.servicePerMinute.toFixed(3)}팀이에요. 여기에 앞 팀 수에 따른 취소·미루기 효과를 더해요. 사건 종류는 관측만으로 구분할 수 없어 취소·미루기 가정은 고정했어요. 미루기가 내 뒤로 넘어올 비율은 50%로 가정해요.</p>
    <h3>다른 매장은 두 번째 기록부터 자체 속도를 사용해요</h3><p>예측하기를 누르면 현재 시각과 순서로 계산하고 자동 기록해요. 오늘 기록이 하나 이하면 킨카라멘 기준을 임시 사용하고, 두 개부터는 이 매장 기록만으로 호출 속도를 추정해요. 취소·미루기 확률과 내 뒤로 이동할 비율은 기존 고정값을 유지해요. 이전보다 순서 숫자가 커지면 미루기로 판단해 해당 구간을 제외하고, 다른 날짜 기록도 제외해요. 유효한 시간 구간이 없으면 기록을 저장한 뒤 다음 관측을 기다려요.</p>
    <h3>도착 3분 전부터가 성공 범위예요</h3><p>도착 3분 전부터 도착 후 선택한 대기시간까지 호출될 확률이 가장 높은 순서를 찾아요. 더 앞 순서가 최적이어도 보여 드리지만, 실제로 앞으로 당길 수는 없어요.</p>
    <p>입장 호출 후 유예 시간은 매장마다 다를 수 있어요. 실제 매장 규정을 확인해주세요.</p>
    <p>킨카라멘은 11:00 전 입장을 예측하지 않아요. 다른 매장에는 영업 시작 제한이 없어요.</p>
  </Collapsible.Content></Collapsible.Root>;
}
