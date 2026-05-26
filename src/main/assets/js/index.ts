import '../scss/main.scss';
import { initAll } from 'govuk-frontend';

initAll();

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  status: TaskStatus;
}

interface TaskPageResponse {
  content?: TaskResponse[];
  number?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}

const statusOptions: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

function getEl<T extends Element>(selector: string, parent: ParentNode = document): T | null {
  return parent.querySelector(selector) as T | null;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function toApiDateTime(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildStatusOptions(currentStatus: TaskStatus): string {
  return statusOptions
    .map(status => {
      const selected = status === currentStatus ? ' selected' : '';
      const label = status.replace('_', ' ');
      return `<option value="${status}"${selected}>${label}</option>`;
    })
    .join('');
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      const errorBody = (await response.json()) as { message?: string };
      if (errorBody?.message) {
        message = errorBody.message;
      }
    } catch {
      // Ignore parse failures and keep the default message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function initTaskSpa(): void {
  const root = getEl<HTMLElement>('#tasks-spa');

  if (!root) {
    return;
  }

  const apiBase = root.dataset.apiBase || '/api/tasks';
  const messageEl = getEl<HTMLElement>('[data-message]', root);
  const createForm = getEl<HTMLFormElement>('[data-create-form]', root);
  const refreshButton = getEl<HTMLButtonElement>('[data-refresh]', root);
  const tableBody = getEl<HTMLTableSectionElement>('[data-task-table-body]', root);
  const metaEl = getEl<HTMLElement>('[data-task-meta]', root);

  if (!messageEl || !createForm || !refreshButton || !tableBody || !metaEl) {
    return;
  }

  const showMessage = (text: string, isError = false): void => {
    messageEl.hidden = false;
    messageEl.textContent = text;
    messageEl.classList.toggle('hmcts-task-spa__message--error', isError);
    messageEl.classList.toggle('hmcts-task-spa__message--success', !isError);
  };

  const clearMessage = (): void => {
    messageEl.hidden = true;
    messageEl.textContent = '';
    messageEl.classList.remove('hmcts-task-spa__message--error', 'hmcts-task-spa__message--success');
  };

  const setLoadingTable = (text = 'Loading tasks...'): void => {
    tableBody.innerHTML = `
			<tr class="govuk-table__row">
				<td class="govuk-table__cell" colspan="5">${escapeHtml(text)}</td>
			</tr>
		`;
  };

  const renderTasks = (page: TaskPageResponse): void => {
    const tasks = page.content || [];

    if (!tasks.length) {
      tableBody.innerHTML = `
				<tr class="govuk-table__row">
					<td class="govuk-table__cell" colspan="5">No tasks found.</td>
				</tr>
			`;
      metaEl.textContent = '0 tasks';
      return;
    }

    tableBody.innerHTML = tasks
      .map(task => {
        const safeTitle = escapeHtml(task.title || 'Untitled');
        const safeDescription = escapeHtml(task.description || '');
        const dueDate = task.dueDate ? formatDate(task.dueDate) : '-';

        return `
					<tr class="govuk-table__row" data-task-id="${task.id}">
						<td class="govuk-table__cell">${safeTitle}</td>
						<td class="govuk-table__cell">${safeDescription || '-'}</td>
						<td class="govuk-table__cell">${escapeHtml(dueDate)}</td>
						<td class="govuk-table__cell">
							<label class="govuk-visually-hidden" for="status-${task.id}">Status for ${safeTitle}</label>
							<select class="govuk-select hmcts-task-spa__status-select" id="status-${task.id}" data-status-select>
								${buildStatusOptions(task.status)}
							</select>
						</td>
						<td class="govuk-table__cell">
							<button class="govuk-button govuk-button--secondary hmcts-task-spa__row-button" data-module="govuk-button" data-action="save-status" type="button">Save</button>
							<button class="govuk-button govuk-button--warning hmcts-task-spa__row-button" data-module="govuk-button" data-action="delete" type="button">Delete</button>
						</td>
					</tr>
				`;
      })
      .join('');

    const totalElements = page.totalElements ?? tasks.length;
    const pageIndex = (page.number ?? 0) + 1;
    const totalPages = page.totalPages ?? 1;
    metaEl.textContent = `${totalElements} task(s) • page ${pageIndex} of ${totalPages}`;
  };

  const loadTasks = async (): Promise<void> => {
    setLoadingTable();

    try {
      const page = await fetchJson<TaskPageResponse>(`${apiBase}?page=0&size=100&sort=dueDate,asc`);
      renderTasks(page);
    } catch (error) {
      setLoadingTable('Unable to load tasks.');
      showMessage(error instanceof Error ? error.message : 'Unable to load tasks.', true);
    }
  };

  createForm.addEventListener('submit', async event => {
    event.preventDefault();
    clearMessage();

    const formData = new FormData(createForm);
    const title = String(formData.get('title') || '').trim();
    const description = String(formData.get('description') || '').trim();
    const dueDateLocal = String(formData.get('dueDate') || '').trim();

    if (!title || !dueDateLocal) {
      showMessage('Title and due date are required.', true);
      return;
    }

    try {
      await fetchJson<TaskResponse>(apiBase, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          dueDate: toApiDateTime(dueDateLocal),
        }),
      });

      createForm.reset();
      showMessage('Task created successfully.');
      await loadTasks();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Unable to create task.', true);
    }
  });

  refreshButton.addEventListener('click', async () => {
    clearMessage();
    await loadTasks();
  });

  tableBody.addEventListener('click', async event => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button[data-action]');

    if (!button) {
      return;
    }

    const row = button.closest<HTMLTableRowElement>('tr[data-task-id]');
    const taskId = row?.dataset.taskId;

    if (!row || !taskId) {
      return;
    }

    clearMessage();
    const action = button.dataset.action;

    if (action === 'delete') {
      const confirmed = window.confirm('Delete this task?');
      if (!confirmed) {
        return;
      }

      try {
        await fetchJson<void>(`${apiBase}/${taskId}`, {
          method: 'DELETE',
        });
        showMessage('Task deleted.');
        await loadTasks();
      } catch (error) {
        showMessage(error instanceof Error ? error.message : 'Unable to delete task.', true);
      }
      return;
    }

    if (action === 'save-status') {
      const select = getEl<HTMLSelectElement>('[data-status-select]', row);
      if (!select) {
        return;
      }

      try {
        await fetchJson<TaskResponse>(`${apiBase}/${taskId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: select.value }),
        });
        showMessage('Task status updated.');
        await loadTasks();
      } catch (error) {
        showMessage(error instanceof Error ? error.message : 'Unable to update status.', true);
      }
    }
  });

  void loadTasks();
}

initTaskSpa();
