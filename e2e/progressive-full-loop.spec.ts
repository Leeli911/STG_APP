import { expect, test } from "@playwright/test";

test("同一浏览器完成 Day 1 到 Day 7，并从总结进入推荐复练", async ({
  page,
  baseURL
}) => {
  test.setTimeout(120_000);
  const forbiddenRequests: string[] = [];
  const appOrigin = new URL(baseURL!).origin;
  page.on("request", (request) => {
    const url = new URL(request.url());
    const isApiTransport = ["fetch", "xhr"].includes(request.resourceType());
    const isAppApi =
      url.origin === appOrigin && url.pathname.startsWith("/api/");
    const isExternalApi = url.origin !== appOrigin && isApiTransport;
    const isKnownModelOrDatabase =
      /(?:openai\.com|supabase\.(?:co|in))$/i.test(url.hostname);
    if (isAppApi || isExternalApi || isKnownModelOrDatabase) {
      forbiddenRequests.push(request.url());
    }
  });

  await page.goto("/training-demo");
  await expect(
    page.getByRole("button", { name: "开始第 1 课" })
  ).toBeVisible();
  await page.getByRole("button", { name: "开始第 1 课" }).click();
  await expect(page.locator("#current-lesson")).toBeFocused();

  await page
    .getByRole("button", { name: "我理解了，做两道简单检查" })
    .click();
  await page.getByRole("radio", { name: "产品负责人" }).check();
  await page
    .getByRole("radio", { name: "决定是否优先优化注册流程" })
    .check();
  await page.getByRole("button", { name: "检查我的选择" }).click();
  await page
    .getByRole("button", { name: "进入第 2 天：写一句明确目的" })
    .click();

  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "团队会议与客户演示时间冲突，请主管今天决定调整哪一个。"
    })
    .check();
  await page.getByRole("button", { name: "检查这句话" }).click();
  await page
    .getByRole("radio", { name: "今天决定把团队会议调整到四点" })
    .check();
  await page.getByRole("button", { name: "组合目的句" }).click();
  await page
    .getByRole("button", { name: "进入一句话独立练习" })
    .click();
  await page
    .getByLabel("用一句话写出你的明确目的")
    .fill(
      "本期预算已经使用九成，我申请项目负责人批准缩小本期范围，暂缓两个非核心需求。"
    );
  await page.getByRole("button", { name: "检查这句话" }).click();
  await page.getByRole("button", { name: "完成第 2 课" }).click();
  await page
    .getByRole("button", { name: "进入第 3 天：把结论放到第一句" })
    .click();

  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "建议先调整权限配置培训，因为这是新人最集中的卡点。"
    })
    .check();
  await page.getByRole("button", { name: "检查第一句" }).click();
  await page.getByLabel("第 1 句").selectOption("conclusion");
  await page.getByLabel("第 2 句").selectOption("reason");
  await page.getByLabel("第 3 句").selectOption("detail");
  await page.getByRole("button", { name: "检查句子顺序" }).click();
  await page
    .getByRole("button", { name: "进入结论先行独立练习" })
    .click();
  await page
    .getByLabel("你的 2–3 句回答")
    .fill(
      "项目存在周五上线风险，我建议先解决联调问题再发布。目前核心功能已经完成，但联调问题可能影响周五计划。"
    );
  await page.getByRole("button", { name: "检查我的首句" }).click();
  await page.getByRole("button", { name: "完成第 3 课" }).click();
  await page
    .getByRole("button", { name: "进入第 4 天：用一个理由支撑结论" })
    .click();

  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "上周四十条咨询中，二十五条都在询问已变更的退款步骤。"
    })
    .check();
  await page.getByRole("button", { name: "检查这条依据" }).click();
  await page
    .getByRole("radio", {
      name: "因为最近十名新人中有六人漏交权限申请，旧清单也没有写这一步。"
    })
    .check();
  await page.getByRole("button", { name: "组合结论和理由" }).click();
  await page
    .getByRole("button", { name: "进入两句话独立练习" })
    .click();
  await page
    .getByLabel("你的两句话回答")
    .fill("建议更新周报提交检查清单。最近四次周报中有三次漏填新增的风险字段。");
  await page.getByRole("button", { name: "检查结论和理由" }).click();
  await page.getByRole("button", { name: "完成第 4 课" }).click();
  await page
    .getByRole("button", { name: "进入第 5 天：把信息整理成两到三点" })
    .click();

  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "第一，用户影响；第二，交付风险；第三，维护成本。"
    })
    .check();
  await page.getByRole("button", { name: "检查分点方式" }).click();
  await page
    .getByLabel("“近两周相关用户投诉增加了。”所属分组")
    .selectOption("customer-impact");
  await page
    .getByLabel("“同一问题经常需要用户再次联系确认。”所属分组")
    .selectOption("customer-impact");
  await page
    .getByLabel("“最近三个任务中有两个发生延期。”所属分组")
    .selectOption("delivery-risk");
  await page
    .getByLabel("“关键里程碑依赖人工检查，容易被遗漏。”所属分组")
    .selectOption("delivery-risk");
  await page
    .getByLabel("“团队每周要花数小时重复返工。”所属分组")
    .selectOption("maintenance-cost");
  await page
    .getByLabel("“当前每次提交都需要两名同事手工核对。”所属分组")
    .selectOption("maintenance-cost");
  await page.getByRole("button", { name: "检查信息分组" }).click();
  await page.getByRole("button", { name: "进入三点独立练习" }).click();
  await page
    .getByLabel("你的结论和三个要点")
    .fill(
      "建议下一阶段优先优化新用户引导。第一，用户流失集中在前三步。第二，相关客服咨询很多。第三，改动成本相对较低。"
    );
  await page.getByRole("button", { name: "检查三个要点" }).click();
  await page.getByRole("button", { name: "完成第 5 课" }).click();
  await page
    .getByRole("button", { name: "进入第 6 天：完成一次完整工作汇报" })
    .click();

  await page
    .getByRole("button", { name: "我理解了，做一个简单检查" })
    .click();
  await page
    .getByRole("radio", {
      name: "先给结论，再分点说明依据，最后提出有时限的行动请求。"
    })
    .check();
  await page.getByRole("button", { name: "检查汇报顺序" }).click();
  await page.getByLabel("1. 先给结论").selectOption("conclusion");
  await page.getByLabel("2. 第一项依据").selectOption("point-one");
  await page.getByLabel("3. 第二项依据").selectOption("point-two");
  await page.getByLabel("4. 行动请求").selectOption("request");
  await page.getByRole("button", { name: "检查完整结构" }).click();
  await page
    .getByRole("button", { name: "进入完整汇报独立练习" })
    .click();
  await page
    .getByLabel("你的 4–6 句完整汇报")
    .fill(
      "建议将本周五发布推迟到下周一。第一，两个关键接口仍未通过联调。第二，最近三次测试有两次出现数据同步失败。第三，客户培训已经调整到下周一。请负责人今天批准将发布推迟到下周一。"
    );
  await page.getByRole("button", { name: "检查完整汇报" }).click();
  await page.getByRole("button", { name: "完成第 6 课" }).click();
  await page.getByRole("button", { name: "进入第 7 天毕业项目" }).click();

  await page.getByRole("button", { name: "开始毕业项目" }).click();
  await page
    .getByLabel("你的毕业项目首稿")
    .fill(
      "建议将客服工单系统切换推迟到下周一。首先，历史工单目前只迁移了60％。其次，试运行中有8％的附件缺失。请运营总监今天批准将系统切换推迟到下周一。"
    );
  await page.getByRole("button", { name: "冻结首稿并查看证据" }).click();
  await page
    .getByRole("button", { name: "首稿已完整，直接进入新场景" })
    .click();
  await page
    .getByLabel("你的新场景回答")
    .fill(
      "建议把剩余预算集中投放到渠道A。一方面，渠道A获客成本82元、转化率7.8%。另一方面，剩余预算只够支持一个渠道。请市场负责人今天批准把剩余预算集中投放到渠道A。"
    );
  await page.getByRole("button", { name: "检查新场景回答" }).click();
  await page
    .getByRole("button", { name: "完成课程并记录迁移达标" })
    .click();
  await expect(
    page.getByRole("heading", { name: "七天训练完成 · 即时迁移达标" })
  ).toBeVisible();

  await page.getByRole("radio", { name: "把信息分成不同要点" }).check();
  await page.getByRole("radio", { name: "看一眼提示就能完成" }).check();
  await page.getByRole("radio", { name: "向主管汇报" }).check();
  await page
    .getByRole("button", { name: "保存自检并生成复练建议" })
    .click();
  await expect(
    page.getByRole("heading", { name: "复练第 5 天：整理两到三个要点" })
  ).toBeVisible();
  await page.getByRole("button", { name: "进入推荐复练" }).click();
  await expect(
    page.getByRole("heading", { name: "把信息整理成两到三点" })
  ).toBeVisible();
  await expect(page.getByText("当前进度 7 / 7 课")).toBeVisible();
  expect(forbiddenRequests).toEqual([]);
});
