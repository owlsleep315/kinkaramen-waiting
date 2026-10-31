import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown, BookOpen, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { MODEL } from '../models/modelConstants';
export function ModelExplanation() {
  const [open, setOpen] = useState(false);
  return <Collapsible.Root className="card model-card" open={open} onOpenChange={setOpen}><Collapsible.Trigger className="model-trigger"><span className="model-title"><BookOpen size={19}/><span>어떻게 예측하나요?<small>실측 기록과 예측의 한계</small></span></span><ChevronDown size={20} className={open ? 'rotate' : ''}/></Collapsible.Trigger><Collapsible.Content className="model-content">
    <div className="model-intro"><ShieldCheck size={19}/><span>내 기록은 이 브라우저에서만 사용해요.</span></div>
    <h3>확인한 시간 사이의 변화를 계산해요</h3><p>10/29·10/30 기록 중 직접 미루기를 제외한 47구간, 223분 동안의 72칸 감소를 반영했어요. 7분 사이 2칸 감소했다면 그 7분 안에서 일어난 변화로 처리해요. 확인한 순간에 두 팀이 동시에 입장했다고 가정하지 않아요.</p>
    <h3>앞 팀이 많으면 줄어들 기회도 많아요</h3><p>기준 서비스 성분은 분당 {MODEL.servicePerMinute.toFixed(3)}팀이에요. 여기에 앞 팀 수에 따른 취소·미루기 효과를 더해요. 사건 종류는 관측만으로 구분할 수 없어 취소·미루기 가정은 고정했어요. 전체 대기열을 모르는 만큼 미루기가 내 뒤로 넘어올 비율은 50%로 가정해요.</p>
    <h3>다른 매장은 예측할 때마다 기록해요</h3><p>예측하기를 누르면 현재 시각과 순서로 계산하고, 완료된 예측은 자동으로 기록해요. 기록을 직접 추가하거나 수정할 수 없고 삭제만 할 수 있어요. 이전보다 순서 숫자가 커지면 미루기로 판단해 해당 구간을 제외해요. 유효한 시간 구간이 없으면 킨카라멘 기준을 사용하고, 구간이 쌓이면 이곳의 속도를 보정해요. 취소·미루기 가정은 같고, 그 효과를 중복해서 더하지 않아요. 다른 날짜 기록도 제외해요.</p>
    <h3>도착 3분 전부터가 성공 범위예요</h3><p>도착 3분 전부터 도착 후 선택한 대기시간까지 호출될 확률이 가장 높은 순서를 찾아요. 더 앞 순서가 최적이어도 보여 드리지만, 실제로 앞으로 당길 수는 없어요. 1번째가 돼도 다음 호출까지 기다릴 수 있어요.</p>
    <p>킨카라멘은 11:00 전 입장을 예측하지 않아요. 다른 매장에는 영업 시작 제한이 없어요. 등록 마감과 재오픈은 내 순서를 직접 바꾸지 않아 고정 시각으로 차단하지 않아요.</p>
    <p className="small-muted">두 날짜만으로 실제 정확도를 보장할 수 없어요. 실제 호출 시각 기록이 없어 마지막 호출 대기와 표시 확률은 검증되지 않은 가정을 포함해요. 다른 매장도 유예 3분을 가정하므로 실제 매장 규정을 확인해 주세요. 브라우저 기록은 서버·GitHub·킨카라멘 고정 계수에 반영되지 않아요.</p>
  </Collapsible.Content></Collapsible.Root>;
}
