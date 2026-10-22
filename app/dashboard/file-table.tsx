import type { DriveFile } from "@/lib/google/drive";

/** Recent Drive files (FR-07). Names are truncated visually; the full name shows on hover and focus. */
export function FileTable({ files }: { files: DriveFile[] }) {
  if (files.length === 0) {
    return <p className="text-sm text-zinc-700">No files found in your Google Drive.</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-zinc-600">
            <th scope="col" className="px-4 py-2 font-medium sm:pl-0">Name</th>
            <th scope="col" className="px-4 py-2 font-medium">Type</th>
            <th scope="col" className="px-4 py-2 font-medium">Last modified</th>
            <th scope="col" className="px-4 py-2 font-medium sm:pr-0">
              <span className="sr-only">Link</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className="border-b border-zinc-100 last:border-0">
              <td className="px-4 py-2.5 sm:pl-0">
                <span
                  tabIndex={0}
                  title={file.name}
                  className="block max-w-[14rem] truncate rounded text-zinc-900 outline-none focus:whitespace-normal focus:break-words focus-visible:ring-2 focus-visible:ring-zinc-900/30 sm:max-w-xs"
                >
                  {file.name}
                </span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-zinc-700">{file.typeLabel}</td>
              <td className="px-4 py-2.5 whitespace-nowrap text-zinc-700">
                <time dateTime={file.modifiedIso}>{file.modifiedLabel}</time>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap sm:pr-0">
                {file.link && (
                  <a
                    href={file.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
                  >
                    Open in Drive<span className="sr-only">: {file.name} (opens in a new tab)</span>
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
