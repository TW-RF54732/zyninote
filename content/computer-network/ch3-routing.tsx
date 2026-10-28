import { Link, Section } from "zyninote";

export const meta = {
  title: "路由",
  tags: ["網路層"],
  order: 3,
  summary: "距離向量與鏈結狀態演算法",
};

export default function Routing() {
  return (
    <>
      <p>
        路由演算法決定封包從來源到目的地要走哪條路徑，屬於 <Link to="ch1-intro.md#osi-七層" quiet>網路層</Link> 的工作；端到端的可靠傳輸則交給{" "}
        <Link to="ch2-tcp.mdx">TCP</Link>。
      </p>

      <Section id="link-state" title="鏈結狀態">
        <p>
          每個路由器知道整個網路拓撲，用 Dijkstra 演算法算出最短路徑；與只問鄰居的{" "}
          <Link to="ch3-routing.tsx#distance-vector" quiet>距離向量</Link> 相對。路徑成本常以 <Link to="ch1-intro.md#延遲" quiet>延遲</Link> 衡量。
        </p>
        <Section id="dijkstra" title="Dijkstra 步驟" fold>
          <ol>
            <li>起點距離設為 0，其他設為無限大。</li>
            <li>取出未處理中距離最小的節點。</li>
            <li>用它更新鄰居的距離，重複直到全部處理完。</li>
          </ol>
        </Section>
      </Section>

      <Section id="distance-vector" title="距離向量">
        <p>
          每個路由器只和鄰居交換距離表，依 Bellman-Ford 方程式更新；對照需要全網拓撲的{" "}
          <Link to="ch3-routing.tsx#link-state" quiet>鏈結狀態</Link>。
        </p>
        <Section id="count-to-infinity" title="無限計數問題">
          <p>壞消息傳得慢：鏈路斷掉時，距離可能一點一點往上加。</p>
        </Section>
      </Section>
    </>
  );
}
