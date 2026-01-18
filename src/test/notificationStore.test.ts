import { NotificationStore } from "../util/notificationStore";

describe("NotificationStore", () => {
  test("stores loading state and errors", () => {
    const store = new NotificationStore();
    store.setLoading(true);
    store.setError("boom");

    expect(store.isLoading()).toBe(true);
    expect(store.getError()).toBe("boom");
  });

  test("stores notification list", () => {
    const store = new NotificationStore();
    store.setNotifications([{ id: 1, title: "hello" }]);

    expect(store.getNotifications()).toEqual([{ id: 1, title: "hello" }]);
  });
});
