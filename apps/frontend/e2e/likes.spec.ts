import { expect, test } from "@playwright/test";

import { signIn } from "./signIn";

const API = "http://localhost:4050/api";

test("E2E-01: like a quack, reload the feed, and take the like back", async ({
  page,
}) => {
  await signIn(page, "caffeinatedduck@example.com", "password1");
  const text = `Like flow ${Date.now()}`;
  const created = await page.request.post(`${API}/quacks`, {
    data: { text },
  });
  expect(created.status()).toBe(201);
  await page.goto("/quacks");

  let quack = page.getByRole("article").filter({ hasText: text });
  await expect(quack).toBeVisible();
  let likeButton = quack.getByRole("button", { name: /like/i });
  await expect(likeButton).toBeVisible();
  await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  await expect(quack.getByText("0", { exact: true })).toBeVisible();

  await likeButton.click();
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await expect(quack.getByText("1", { exact: true })).toBeVisible();

  await page.reload();
  quack = page.getByRole("article").filter({ hasText: text });
  likeButton = quack.getByRole("button", { name: /like/i });
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await expect(quack.getByText("1", { exact: true })).toBeVisible();

  await likeButton.click();
  await expect(likeButton).toHaveAttribute("aria-pressed", "false");
  await expect(quack.getByText("0", { exact: true })).toBeVisible();
});

test("E2E-02: failed unlike restores the liked heart and count and shows an error", async ({
  page,
}) => {
  await signIn(page, "caffeinatedduck@example.com", "password1");
  const text = `Failed unlike ${Date.now()}`;
  const created = await page.request.post(`${API}/quacks`, {
    data: { text },
  });
  expect(created.status()).toBe(201);
  const quackId = (await created.json()).id as string;
  const liked = await page.request.put(`${API}/quacks/${quackId}/likes`);
  expect(liked.ok()).toBe(true);
  await page.goto("/quacks");

  const quack = page.getByRole("article").filter({ hasText: text });
  const likeButton = quack.getByRole("button", { name: /like/i });
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await expect(quack.getByText("1", { exact: true })).toBeVisible();
  await page.route(`${API}/quacks/${quackId}/likes`, (route) => route.abort());

  await likeButton.click();
  await expect(quack.getByRole("alert")).toBeVisible();
  await expect(likeButton).toHaveAttribute("aria-pressed", "true");
  await expect(quack.getByText("1", { exact: true })).toBeVisible();
});

test("E2E-03: a deleted-quack placeholder has no like control or count", async ({
  page,
}) => {
  await signIn(page, "caffeinatedduck@example.com", "password1");
  const rootText = `Deleted like root ${Date.now()}`;
  const replyText = `Surviving reply ${Date.now()}`;
  const created = await page.request.post(`${API}/quacks`, {
    data: { text: rootText },
  });
  expect(created.status()).toBe(201);
  const rootId = (await created.json()).id as string;
  const reply = await page.request.post(`${API}/quacks/${rootId}/replies`, {
    data: { text: replyText },
  });
  expect(reply.status()).toBe(201);
  const deleted = await page.request.delete(`${API}/quacks/${rootId}`);
  expect(deleted.status()).toBe(204);
  await page.goto("/quacks");

  const placeholder = page
    .getByRole("article")
    .filter({ hasText: "Deleted quack" })
    .first();
  await expect(placeholder).toBeVisible();
  await placeholder.getByRole("button", { name: /Expand 1 replies/ }).click();
  await expect(placeholder.getByText(replyText)).toBeVisible();
  await expect(placeholder.getByRole("button", { name: /like/i })).toHaveCount(
    0,
  );
  await expect(placeholder.getByText("0", { exact: true })).toHaveCount(0);
});
