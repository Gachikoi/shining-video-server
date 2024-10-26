export interface User{
  "name": string,
  "email": string,
  "password": string,
  "avatarPath": string
}

export interface Comment{
  id: string,
  data: number,
  user: {
    id: string
    name?: string,
    avatarPath?:string
  }
  content: string
  replies: ReplyArr
}

export type CommentArr = Comment[]

export interface Reply{
  id: string,
  data: number,
  user: {
    id: string
    name?: string,
    avatarPath?: string
  }
  content: string
}

export type ReplyArr=Reply[]