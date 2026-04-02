import { Notifier, notifierProvider } from "react-river";

class TimerNotifier extends Notifier<number> {
  private timer: any;

  build() {
    console.log("🌊 [CREATE] TimerNotifier initialized");

    this.timer = setInterval(() => {
      this.state += 1;
    }, 1000);

    this.onDispose(() => {
      console.log("🌊 [DISPOSE] TimerNotifier cleaned up");
      clearInterval(this.timer);
    });

    return 0;
  }

  add() {
    this.state += 1;
  }
}

export const timerProvider = notifierProvider(() => new TimerNotifier(), {
  name: "timer",
  autoDispose: true,
});
