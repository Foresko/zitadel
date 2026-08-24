import { Alert, AlertType } from "./alert";

export function GoogleAppleIdRecoveryNotice() {
  return (
    <div className="pt-2 text-left text-sm">
      <Alert type={AlertType.ALERT}>
        <span className="block leading-5 font-semibold">
          Вход через Google и Apple ID недоступен для пользователей из России.
        </span>
        <span className="mt-3 block leading-5 opacity-90">Если вы раньше входили этим способом:</span>
        <span className="mt-2 block space-y-1.5 leading-5">
          <span className="flex gap-2">
            <span className="font-semibold tabular-nums opacity-70">1.</span>
            Введите e-mail на этой странице.
          </span>
          <span className="flex gap-2">
            <span className="font-semibold tabular-nums opacity-70">2.</span>
            На следующем шаге нажмите «Сбросить пароль».
          </span>
          <span className="flex gap-2">
            <span className="font-semibold tabular-nums opacity-70">3.</span>
            Перейдите по ссылке из письма и задайте пароль.
          </span>
        </span>
        <span className="mt-3 block border-t border-current/15 pt-3 leading-5">
          Если восстановить доступ не удаётся, обратитесь в&nbsp;
          <a
            className="font-medium underline underline-offset-2 transition-colors hover:opacity-80"
            href="https://t.me/Foresko_Support"
            target="_blank"
            rel="noreferrer"
          >
            поддержку
          </a>
          .
        </span>
      </Alert>
    </div>
  );
}
