import { experimentsRouter } from './routers/experiments'
import { nanoporeRouter } from './routers/nanopore'
import { userRouter } from './routers/user'
import { router } from './trpc'

export type { Context, Env, Session, SessionUser } from './context'

export { getUser } from './actions/users/getters'

// Export file storage functions and types
export { 
  uploadFileAttachment, 
  getSampleAttachments, 
  deleteFileAttachment, 
  getFileContent 
} from './actions/nanopore/file-storage'

export type { 
  FileUploadResult, 
  UploadFileInput 
} from './actions/nanopore/file-storage'

export const appRouter = router({
  user: userRouter,
  experiments: experimentsRouter,
  nanopore: nanoporeRouter,
})

// Export type router type signature,
// NOT the router itself.
export type AppRouter = typeof appRouter
