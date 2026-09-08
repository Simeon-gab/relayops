import { cookies } from 'next/headers'

/**
 * The MD's "full system" preference.
 *
 * The MD lands on a deliberately small screen. This cookie lets them opt into
 * the manager's dashboard and sidebar instead, and have that choice survive
 * navigation and the next sign-in. It is a display preference only: the md
 * role already carries every permission the manager has, so nothing here
 * grants access — it only changes what is shown first.
 *
 * Kept in a cookie rather than the users table so it needs no migration and
 * follows the browser, which is where "how I like my screen" belongs.
 */
export const MD_FULL_VIEW_COOKIE = 'relayops-md-full-view'

export async function readMdFullView(): Promise<boolean> {
  const store = await cookies()
  return store.get(MD_FULL_VIEW_COOKIE)?.value === '1'
}
