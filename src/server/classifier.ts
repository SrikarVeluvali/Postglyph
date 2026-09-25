import { choice, TypeSafeClient } from '@typesafe-ai/sdk';
import { CRITERIA, isLabel, type Classification, type PostInput } from '../shared/taxonomy.js';

export type Classifier = (post: PostInput) => Promise<Classification>;

export function makeClassifier(apiKey: string): Classifier {
  const client = new TypeSafeClient({ apiKey });

  return async (post) => {
    const response = await client.systemOne({
      model: 'jev-latest',
      state: {
        post: {
          text: post.text,
          author: post.author || '',
          repost_text: post.repostText || ''
        }
      },
      questions: {
        purpose: choice(
          'What is the dominant purpose of `post.text`, considering `post.repost_text` only when present? Choose the single best category from the text supplied. Do not infer details absent from the post.',
          CRITERIA
        )
      }
    });
    const answer = response.answers.purpose;
    if (!isLabel(answer.choice)) throw new Error('TypeSafe returned an unknown category');
    return {
      label: answer.choice,
      confidence: answer.confidence,
      probabilities: answer.probabilities as Record<keyof typeof CRITERIA, number>,
      model: response.model
    };
  };
}
